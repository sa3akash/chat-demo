import Elysia, { t } from "elysia";
import Redis from "ioredis";
import { tokenEngine, AuthPayload } from "@/middlewares/auth";
import { db, conversations, messages, conversationMembers } from "@/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

const REDIS_HOST = process.env.REDIS_URL || "redis://localhost:6379";

// Dual Redis Clients with robust reconnection strategy
export const redisClient = new Redis(REDIS_HOST, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
  lazyConnect: true,
});

export const redisSub = new Redis(REDIS_HOST, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
  lazyConnect: true,
});

redisClient.on("error", (err) => {
  logger.error({ err: err.message }, "Redis Client Error");
});

redisSub.on("error", (err) => {
  logger.error({ err: err.message }, "Redis Subscriber Error");
});

// Reference to Bun/Elysia Server instance for zero-copy native uWS broadcasting
let gatewayServer: any = null;

export function setGatewayServer(server: any) {
  gatewayServer = server;
  logger.info("Gateway server instance registered for uWS pub/sub");
}

// Initialize Redis Connections & Pattern Subscription
async function initRedis() {
  try {
    await Promise.all([redisClient.connect(), redisSub.connect()]);
    logger.info("Redis clients connected successfully");

    // Pattern-subscribe to all cluster broadcast channels
    await redisSub.psubscribe("channel:*");
    logger.info("Subscribed to Redis pattern channel:*");

    redisSub.on("pmessage", (_pattern, channel, rawMessage) => {
      // e.g. "channel:conversation:123" -> topic: "conversation:123"
      // e.g. "channel:user:456" -> topic: "user:456"
      // e.g. "channel:presence" -> topic: "presence"
      const topic = channel.replace(/^channel:/, "");
      if (gatewayServer?.publish) {
        gatewayServer.publish(topic, rawMessage);
      }
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to initialize Redis Pub/Sub");
  }
}

initRedis();

// Local node socket tracking: userId -> Set of connected WebSockets
const localUserSockets = new Map<string, Set<any>>();

// Authenticate token safely
function verifyWsToken(token: string): { userId: string; username: string } | null {
  try {
    const result = tokenEngine.decrypt<AuthPayload>(token);
    if (result.success && result.data?.id) {
      return {
        userId: result.data.id,
        username: result.data.username || "User",
      };
    }
  } catch (err) {
    logger.warn({ err }, "WS Token verification failed");
  }
  return null;
}

const auth = new Elysia({ name: "ws-auth" }).derive(
  { as: "scoped" },
  async ({ query, status }) => {
    const data = verifyWsToken(query.token);
    if (!data) return status(401);
    return { userId: data.userId, username: data.username };
  }
);

// Lazy presence batch endpoint
export const presenceApi = new Elysia({ prefix: "/api" }).post(
  "/presence/batch",
  async ({ body }: { body: { userIds: string[] } }) => {
    if (!body.userIds || body.userIds.length === 0) return { online: [] };

    const targetIds = body.userIds.slice(0, 200);
    const keys = targetIds.map((id) => `presence:${id}`);

    try {
      const results = await redisClient.mget(keys);
      const online: string[] = [];
      results.forEach((val, idx) => {
        if (val !== null) online.push(targetIds[idx]);
      });
      return { online };
    } catch (err: any) {
      logger.error({ err: err.message }, "Presence batch lookup failed");
      return { online: [] };
    }
  },
  {
    body: t.Object({
      userIds: t.Array(t.String()),
    }),
  }
);

// Scalable WebSocket Gateway
export const websocket = new Elysia()
  .use(auth)
  .use(presenceApi)
  .ws("/ws", {
    query: t.Object({ token: t.String() }),
    body: t.Object({
      type: t.String(),
      payload: t.Optional(t.Any()),
    }),

    async open(ws) {
      const userId = ws.data.userId as string;
      const userTopic = `user:${userId}`;

      // 1. Subscribe this socket to personal topic & global presence topic
      ws.subscribe(userTopic);
      ws.subscribe("presence");

      // 2. Track connection locally on this node
      let sockets = localUserSockets.get(userId);
      if (!sockets) {
        sockets = new Set();
        localUserSockets.set(userId, sockets);
      }
      sockets.add(ws);

      try {
        // 3. Increment cluster connection count in Redis
        const totalConnections = await redisClient.incr(`connections:${userId}`);
        await redisClient.set(`presence:${userId}`, 1, "EX", 45);
        await redisClient.sadd("presence:online_set", userId);

        // Immediately send all currently online users to this newly connected socket
        const allOnlineUsers = await redisClient.smembers("presence:online_set");
        ws.send(
          JSON.stringify({
            type: "presence:initial",
            payload: { onlineUserIds: allOnlineUsers },
          })
        );

        // Broadcast online presence across cluster
        await redisClient.publish(
          "channel:presence",
          JSON.stringify({
            type: "presence:update",
            payload: { userId, status: "online" },
          })
        );
      } catch (err: any) {
        logger.error({ err: err.message, userId }, "Failed to update presence on open");
      }
    },

    async message(ws, message) {
      const senderId = ws.data.userId as string;
      const username = ws.data.username as string;
      const type = message.type;
      const payload = message.payload || {};

      try {
        // 1. Heartbeat: refresh 45-second presence lease
        if (type === "heartbeat") {
          await redisClient.set(`presence:${senderId}`, 1, "EX", 45);
          await redisClient.sadd("presence:online_set", senderId);
          ws.send(
            JSON.stringify({
              type: "heartbeat:ack",
              payload: { timestamp: Date.now() },
            })
          );
          return;
        }

        // Fetch current online users
        if (type === "presence:get") {
          const allOnlineUsers = await redisClient.smembers("presence:online_set");
          ws.send(
            JSON.stringify({
              type: "presence:initial",
              payload: { onlineUserIds: allOnlineUsers },
            })
          );
          return;
        }

        // 2. Room Join (Conversation Topic)
        if (type === "room:join") {
          const { conversationId } = payload;
          if (conversationId && typeof conversationId === "string") {
            ws.subscribe(`conversation:${conversationId}`);
          }
          return;
        }

        // 3. Room Leave (Conversation Topic)
        if (type === "room:leave") {
          const { conversationId } = payload;
          if (conversationId && typeof conversationId === "string") {
            ws.unsubscribe(`conversation:${conversationId}`);
          }
          return;
        }

        // 4. Send Message: Persist to Postgres + Cluster Broadcast + Ack
        if (type === "chat:send" || type === "send_message") {
          const { conversationId, content, type: msgType = "text", tempId, replyToId, attachments = [] } = payload;

          if (!conversationId || !content) {
            ws.send(
              JSON.stringify({
                type: "error",
                payload: { code: "INVALID_PAYLOAD", message: "conversationId and content are required" },
              })
            );
            return;
          }

          // A. Persist message to database
          const [newMessage] = await db
            .insert(messages)
            .values({
              conversationId,
              content,
              type: msgType,
              senderId,
              replyToId: replyToId || null,
              attachments: attachments || [],
            })
            .returning();

          // B. Update conversation last message pointer & time
          await db
            .update(conversations)
            .set({
              lastMessageAt: newMessage.createdAt,
              lastMessageId: newMessage.id,
            })
            .where(eq(conversations.id, conversationId));

          // C. Increment unread count for other participants
          await db
            .update(conversationMembers)
            .set({
              unreadCount: sql`${conversationMembers.unreadCount} + 1`,
            })
            .where(
              and(
                eq(conversationMembers.conversationId, conversationId),
                ne(conversationMembers.userId, senderId)
              )
            );

          const fullMessagePayload = {
            id: newMessage.id,
            tempId,
            conversationId,
            content: newMessage.content,
            type: newMessage.type,
            senderId,
            sender: {
              id: senderId,
              username,
            },
            replyToId: newMessage.replyToId,
            attachments: newMessage.attachments,
            reactions: newMessage.reactions || {},
            createdAt: newMessage.createdAt.toISOString(),
          };

          // D. Broadcast message to all active viewers of this conversation
          await redisClient.publish(
            `channel:conversation:${conversationId}`,
            JSON.stringify({
              type: "chat:new",
              payload: fullMessagePayload,
            })
          );

          // E. Send direct acknowledgment to sender with permanent DB ID
          ws.send(
            JSON.stringify({
              type: "chat:ack",
              payload: {
                tempId,
                messageId: newMessage.id,
                conversationId,
                createdAt: newMessage.createdAt.toISOString(),
              },
            })
          );

          // F. Notify all conversation members on their personal channels for sidebar updates
          const members = await db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, conversationId));

          const sidebarUpdate = JSON.stringify({
            type: "conversation:update",
            payload: {
              conversationId,
              latestMessage: fullMessagePayload,
              lastMessageAt: newMessage.createdAt.toISOString(),
            },
          });

          for (const member of members) {
            await redisClient.publish(`channel:user:${member.userId}`, sidebarUpdate);
          }

          return;
        }

        // 5. Typing Indicator: Lightweight ephemeral broadcast (No DB)
        if (type === "typing:update") {
          const { conversationId, isTyping } = payload;
          if (conversationId) {
            await redisClient.publish(
              `channel:conversation:${conversationId}`,
              JSON.stringify({
                type: "typing:update",
                payload: {
                  conversationId,
                  userId: senderId,
                  username,
                  isTyping: !!isTyping,
                },
              })
            );
          }
          return;
        }

        // 6. Read Receipt: Mark conversation read in DB & notify participants
        if (type === "receipt:read") {
          const { conversationId, messageId } = payload;
          if (!conversationId) return;

          await db
            .update(conversationMembers)
            .set({
              unreadCount: 0,
              lastReadMessageId: messageId || null,
              lastReadAt: new Date(),
            })
            .where(
              and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, senderId)
              )
            );

          // Broadcast read receipt to the conversation
          await redisClient.publish(
            `channel:conversation:${conversationId}`,
            JSON.stringify({
              type: "receipt:read",
              payload: {
                conversationId,
                userId: senderId,
                messageId,
                readAt: new Date().toISOString(),
              },
            })
          );

          // Update user's personal channel to clear unread badge in sidebar
          await redisClient.publish(
            `channel:user:${senderId}`,
            JSON.stringify({
              type: "conversation:update",
              payload: {
                conversationId,
                unreadCount: 0,
              },
            })
          );

          return;
        }

        // 7. Message Reactions: Add/remove emoji reaction on message
        if (type === "reaction:update") {
          const { conversationId, messageId, emoji } = payload;
          if (!conversationId || !messageId || !emoji) return;

          const [targetMsg] = await db
            .select()
            .from(messages)
            .where(eq(messages.id, messageId));

          if (targetMsg) {
            const currentReactions = (targetMsg.reactions as Record<string, string[]>) || {};
            const userList = new Set(currentReactions[emoji] || []);

            if (userList.has(senderId)) {
              userList.delete(senderId);
              if (userList.size === 0) {
                delete currentReactions[emoji];
              } else {
                currentReactions[emoji] = Array.from(userList);
              }
            } else {
              userList.add(senderId);
              currentReactions[emoji] = Array.from(userList);
            }

            await db
              .update(messages)
              .set({ reactions: currentReactions })
              .where(eq(messages.id, messageId));

            await redisClient.publish(
              `channel:conversation:${conversationId}`,
              JSON.stringify({
                type: "reaction:update",
                payload: {
                  conversationId,
                  messageId,
                  reactions: currentReactions,
                  userId: senderId,
                  emoji,
                },
              })
            );
          }
          return;
        }

        // 8. Delete Message for Everyone
        if (type === "message:delete") {
          const { conversationId, messageId } = payload;
          if (!conversationId || !messageId) return;

          const [targetMsg] = await db
            .select()
            .from(messages)
            .where(eq(messages.id, messageId));

          if (targetMsg && targetMsg.senderId === senderId) {
            await db
              .update(messages)
              .set({
                deletedForEveryone: true,
                content: "This message was deleted",
              })
              .where(eq(messages.id, messageId));

            await redisClient.publish(
              `channel:conversation:${conversationId}`,
              JSON.stringify({
                type: "message:delete",
                payload: {
                  conversationId,
                  messageId,
                },
              })
            );
          }
          return;
        }

        // 9. WebRTC Signaling: Initiate Call (Audio or Video)
        if (type === "call:initiate") {
          const { recipientId, conversationId, callType = "audio", offer } = payload;
          if (!recipientId) return;

          await redisClient.publish(
            `channel:user:${recipientId}`,
            JSON.stringify({
              type: "call:incoming",
              payload: {
                conversationId,
                callerId: senderId,
                callerName: username,
                callType,
                offer,
              },
            })
          );
          return;
        }

        // 10. WebRTC Signaling: Accept Call
        if (type === "call:accept") {
          const { callerId, conversationId, answer } = payload;
          if (!callerId) return;

          await redisClient.publish(
            `channel:user:${callerId}`,
            JSON.stringify({
              type: "call:accepted",
              payload: {
                conversationId,
                calleeId: senderId,
                calleeName: username,
                answer,
              },
            })
          );
          return;
        }

        // 11. WebRTC Signaling: Reject Call
        if (type === "call:reject") {
          const { callerId, conversationId } = payload;
          if (!callerId) return;

          await redisClient.publish(
            `channel:user:${callerId}`,
            JSON.stringify({
              type: "call:rejected",
              payload: {
                conversationId,
                calleeId: senderId,
              },
            })
          );
          return;
        }

        // 12. WebRTC Signaling: End Call
        if (type === "call:end") {
          const { targetUserId, conversationId } = payload;
          if (!targetUserId) return;

          await redisClient.publish(
            `channel:user:${targetUserId}`,
            JSON.stringify({
              type: "call:ended",
              payload: {
                conversationId,
                userId: senderId,
              },
            })
          );
          return;
        }

        // 13. WebRTC Signaling: ICE Candidate Exchange
        if (type === "call:ice-candidate") {
          const { targetUserId, candidate, conversationId } = payload;
          if (!targetUserId || !candidate) return;

          await redisClient.publish(
            `channel:user:${targetUserId}`,
            JSON.stringify({
              type: "call:ice-candidate",
              payload: {
                conversationId,
                senderId,
                candidate,
              },
            })
          );
          return;
        }
      } catch (err: any) {
        logger.error({ err: err.message, type, senderId }, "Error processing WS message");
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { code: "SERVER_ERROR", message: "Failed to process message frame" },
          })
        );
      }
    },

    async close(ws) {
      const userId = ws.data.userId as string;
      ws.unsubscribe(`user:${userId}`);
      ws.unsubscribe("presence");

      const sockets = localUserSockets.get(userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          localUserSockets.delete(userId);
        }
      }

      try {
        const remainingConnections = await redisClient.decr(`connections:${userId}`);
        if (remainingConnections <= 0) {
          await redisClient.del(`connections:${userId}`);
          await redisClient.del(`presence:${userId}`);
          await redisClient.srem("presence:online_set", userId);

          // Broadcast offline event across cluster
          await redisClient.publish(
            "channel:presence",
            JSON.stringify({
              type: "presence:update",
              payload: { userId, status: "offline", lastSeen: Date.now() },
            })
          );
        }
      } catch (err: any) {
        logger.error({ err: err.message, userId }, "Failed to update presence on close");
      }
    },
  });

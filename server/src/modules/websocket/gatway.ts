import Elysia, { t } from "elysia";
import Redis from "ioredis";
import { tokenEngine, AuthPayload } from "@/middlewares/auth";

const REDIS_HOST = process.env.REDIS_URL || "redis://localhost:6379";

// 1. Dual Redis Clients: One for commands/queries, one dedicated to pub/sub
const redisClient = new Redis(REDIS_HOST);
const redisSub = new Redis(REDIS_HOST);

await Promise.all([redisClient.connect(), redisSub.connect()]);

// Local reference tracking for sockets connected to THIS specific container/node
const localUserSockets = new Map<string, Set<any>>();

// Authenticate via token query param
function verifyToken(token: string) {
  const result = tokenEngine.decrypt<AuthPayload>(token);
  return result.success ? { userId: result.data.id } : null;
}

const auth = new Elysia({ name: "ws-auth" }).derive(
  { as: "scoped" },
  async ({ query, status }) => {
    const data = verifyToken(query.token);
    if (!data) return status(401);
    return { userId: data.userId };
  }
);

// 2. HTTP Batch Route for Lazy Presence (Fetches only what is on the user's screen)
export const presenceApi = new Elysia({ prefix: "/api" }).post(
  "/presence/batch",
  async ({ body }: { body: { userIds: string[] } }) => {
    if (!body.userIds || body.userIds.length === 0) return { online: [] };

    // Cap query batch size to protect Redis latency
    const targetIds = body.userIds.slice(0, 100);
    const keys = targetIds.map((id) => `presence:${id}`);
    const results = await redisClient.mget(keys);

    const online: string[] = [];
    results.forEach((val, idx) => {
      if (val !== null) online.push(targetIds[idx]);
    });

    return { online };
  },
  {
    body: t.Object({
      userIds: t.Array(t.String()),
    }),
  }
);

// 3. WebSocket Gateway
export const websocket = new Elysia()
  .use(auth)
  .use(presenceApi)
  .ws("/ws", {
    query: t.Object({ token: t.String() }),
    body: t.Object({
      type: t.String(),
      payload: t.Any(),
    }),

    async open(ws) {
      const userId = ws.data.userId as string;
      const userTopic = `user:${userId}`;

      // Subscribe this specific socket connection to native uWS topic
      ws.subscribe(userTopic);

      // Track connection locally
      let sockets = localUserSockets.get(userId);
      const isFirstLocalConnection = !sockets || sockets.size === 0;

      if (!sockets) {
        sockets = new Set();
        localUserSockets.set(userId, sockets);
      }
      sockets.add(ws);

      // If this is the first local connection, bridge Redis Sub to the local uWS topic
      if (isFirstLocalConnection) {
        await redisSub.subscribe(`channel:user:${userId}`, (rawMessage) => {
          // Native C++ broadcast across all tabs of this user connected to THIS node
          ws.publish(userTopic, rawMessage);
        });
      }

      // Mark presence in Redis with an expiration lease (45 seconds)
      await redisClient.set(`presence:${userId}`, 1, "EX", 45);
    },

    async message(ws, message) {
      const senderId = ws.data.userId as string;

      // Efficient Heartbeat: Just bump the Redis TTL
      if (message.type === "heartbeat") {
        await redisClient.set(`presence:${senderId}`, 1, "EX", 45);
        return;
      }

      // Direct Message Routing: Publish ONLY to recipient's personal channel
      if (message.type === "send_message") {
        const { recipientId, content, conversationId } = message.payload;

        const outbound = JSON.stringify({
          type: "new_message",
          payload: {
            conversationId,
            senderId,
            content,
            sentAt: Date.now(),
          },
        });

        // Publish to recipient's cluster channel
        await redisClient.publish(`channel:user:${recipientId}`, outbound);

        // Echo to sender's other connected tabs
        await redisClient.publish(`channel:user:${senderId}`, outbound);
      }
    },

    async close(ws) {
      const userId = ws.data.userId as string;
      ws.unsubscribe(`user:${userId}`);

      const sockets = localUserSockets.get(userId);
      if (!sockets) return;

      sockets.delete(ws);

      // When all connections on this node terminate, unsubscribe from Redis
      if (sockets.size === 0) {
        localUserSockets.delete(userId);
        await redisSub.unsubscribe(`channel:user:${userId}`);
        // Let the Redis key expire naturally or delete it explicitly
        await redisClient.del(`presence:${userId}`);
      }
    },
  });
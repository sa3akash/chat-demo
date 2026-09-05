import { MessageSchema } from "./types";
import { pub, broadcastToLocalUser, userSockets, WS } from "./socketStore";
import {
  db,
  messages,
  conversations,
  conversationMembers,
  notifications,
  users,
} from "@/db";
import { eq, and, ne } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@/lib/logger";

/**
 * Primary Message Switch Router
 */
export async function messageHandler(
  msg: MessageSchema,
  originSocketId: string,
) {
  try {
    switch (msg.type) {
      case "chat": {
        const {
          id: clientMsgId,
          conversationId,
          senderId,
          senderName,
          receiverId,
          groupId,
          text,
          mediaUrl,
          mediaType,
          replyToId,
          createdAt,
        } = msg.payload;

        const messageId = clientMsgId || createId();
        const contentText = text || "";
        const msgType = mediaType || "text";
        const messageDate = new Date(createdAt || Date.now());

        // 1. Persist message to PostgreSQL
        try {
          await db.insert(messages).values({
            id: messageId,
            conversationId,
            senderId,
            content: contentText,
            type: msgType as any,
            replyToId: replyToId || null,
            createdAt: messageDate,
            updatedAt: messageDate,
          });

          // 2. Update conversation's last message timestamp & id
          await db
            .update(conversations)
            .set({
              lastMessageId: messageId,
              lastMessageAt: messageDate,
              updatedAt: messageDate,
            })
            .where(eq(conversations.id, conversationId));
        } catch (dbErr) {
          logger.error({ err: dbErr }, "Failed to save message to database");
        }

        // 3. Determine recipients from database
        let targetRecipients: string[] = [];

        if (groupId) {
          // Group chat: fetch all group members
          const members = await db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, conversationId));

          targetRecipients = members
            .map((m) => m.userId)
            .filter((uid) => uid !== senderId);
        } else if (receiverId) {
          targetRecipients = [receiverId];
        } else {
          // Look up members from conversation
          const members = await db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, conversationId));

          targetRecipients = members
            .map((m) => m.userId)
            .filter((uid) => uid !== senderId);
        }

        // 4. Deliver message to target recipients
        for (const recipientId of targetRecipients) {
          await routeToUser(recipientId, msg);

          // 5. Create in-app notification for recipient
          try {
            const notifId = createId();
            const notificationTitle = groupId
              ? `New message in group`
              : `New message from ${senderName || "Chat"}`;
            const notificationBody =
              contentText.length > 80
                ? contentText.slice(0, 77) + "..."
                : contentText || "Sent a media attachment";

            await db.insert(notifications).values({
              id: notifId,
              userId: recipientId,
              actorId: senderId,
              type: "message",
              title: notificationTitle,
              body: notificationBody,
              link: `/chat/${conversationId}`,
              isRead: false,
              createdAt: new Date(),
            });

            // Dispatch notification payload
            const notifMsg: MessageSchema = {
              type: "notification",
              payload: {
                id: notifId,
                userId: recipientId,
                actorId: senderId,
                actorName: senderName,
                type: "message",
                title: notificationTitle,
                body: notificationBody,
                link: `/chat/${conversationId}`,
                createdAt: Date.now(),
              },
            };

            await routeToUser(recipientId, notifMsg);
          } catch (notifErr) {
            logger.error(
              { err: notifErr },
              "Failed to create/dispatch notification",
            );
          }
        }

        // 6. Multi-tab sync: Deliver to sender's OTHER tabs
        await routeToUser(senderId, msg, originSocketId);
        break;
      }

      case "typing": {
        const { conversationId, senderId, targetId, isTyping } = msg.payload;

        if (targetId && targetId !== conversationId) {
          await routeToUser(targetId, msg);
        } else {
          // Route typing to all members of conversation
          const members = await db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, conversationId));

          for (const member of members) {
            if (member.userId !== senderId) {
              await routeToUser(member.userId, msg);
            }
          }
        }
        break;
      }

      case "receipt": {
        const { conversationId, senderId } = msg.payload;

        // Update read timestamp in conversation_members
        try {
          await db
            .update(conversationMembers)
            .set({ lastReadAt: new Date() })
            .where(
              and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, senderId),
              ),
            );
        } catch (e) {
          logger.error({ err: e }, "Failed to update last_read_at");
        }

        // Notify other conversation members of read status
        const members = await db
          .select({ userId: conversationMembers.userId })
          .from(conversationMembers)
          .where(eq(conversationMembers.conversationId, conversationId));

        for (const member of members) {
          if (member.userId !== senderId) {
            await routeToUser(member.userId, msg);
          }
        }
        break;
      }

      case "reaction": {
        const { targetUserId } = msg.payload;
        await routeToUser(targetUserId, msg);
        break;
      }

      case "group_action": {
        const { memberIds } = msg.payload;
        for (const memberId of memberIds) {
          await routeToUser(memberId, msg);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    logger.error({ err }, "Unhandled error in messageHandler");
  }
}

/**
 * Route message across Redis or fallback to offline store
 */
export async function routeToUser(
  targetUserId: string,
  message: MessageSchema,
  excludeSocketId?: string,
) {
  // If target user is online locally on this server, dispatch immediately
  if (userSockets.has(targetUserId)) {
    broadcastToLocalUser(targetUserId, message, excludeSocketId);
    return;
  }

  // Check global online state across all server instances
  try {
    if (pub.status === "ready") {
      const isOnlineGlobally = await pub.sismember(
        "presence:online",
        targetUserId,
      );

      if (isOnlineGlobally) {
        await pub.publish(
          "chat",
          JSON.stringify({ targetUserId, message, excludeSocketId }),
        );
        return;
      }

      // User is offline: queue for delivery when they reconnect
      await pub.rpush(`offline:${targetUserId}`, JSON.stringify(message));
    }
  } catch (err) {
    logger.error({ err }, "Failed routing message via Redis");
  }
}

/**
 * Flush pending offline messages upon client reconnect
 */
export async function flushOfflineQueue(userId: string, ws: WS) {
  try {
    if (pub.status === "ready") {
      const offlineKey = `offline:${userId}`;
      const queuedMessages = await pub.lrange(offlineKey, 0, -1);

      if (queuedMessages.length > 0) {
        for (const msgStr of queuedMessages) {
          if (ws.readyState === 1) {
            ws.send(msgStr);
          }
        }
        await pub.del(offlineKey);
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed flushing offline queue");
  }
}

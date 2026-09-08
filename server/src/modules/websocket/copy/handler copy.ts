import { logger } from "@/lib/logger";
import { broadcastToLocalUser, pub, userSockets, WS } from "../demo/socketStore";
import { MessageSchema } from "../types";

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



        // 3. Determine recipients from database
        let targetRecipients: string[] = [];

        if (groupId) {
          // Group chat: fetch all group members

        } else if (receiverId) {
          targetRecipients = [receiverId];
        } else {
          // Look up members from conversation

        }

        // 6. Multi-tab sync: Deliver to sender's OTHER tabs
        await routeToUser(senderId, msg, originSocketId);
        break;
      }

      case "typing": {
        const { conversationId, senderId, targetId, isTyping } = msg.payload;

        break;
      }

      case "receipt": {
        const { conversationId, senderId } = msg.payload;

        // Update read timestamp in conversation_members



        // Notify other conversation members of read status

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

      case "heartbeat": {
        const status = "online";
        logger.info(`user ${msg.payload.userId} is online`);

        await pub.sadd("presence:online", msg.payload.userId);

        const presenceMsg: MessageSchema = {
          type: "presence",
          payload: {
            userId: msg.payload.userId,
            status,
            lastSeen: Date.now(),
          },
        };

        await pub.publish("chat", JSON.stringify({
          targetUserId: "*",
          message: presenceMsg,
          excludeSocketId: originSocketId,
        }));

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

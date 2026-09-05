import { MessageSchema } from "./types";
import { pub, broadcastToLocalUser, userSockets, WS } from "./socketStore";

/**
 * Primary Message Switch Router
 */
export async function messageHandler(msg: MessageSchema) {
  switch (msg.type) {
    case "chat": {
      const { receiverId, groupId } = msg.payload;
      if (receiverId) {
        await routeToUser(receiverId, msg);
      } else if (groupId) {
        await routeToGroup(groupId, msg);
      }
      break;
    }

    case "typing": {
      const { targetId } = msg.payload;
      await routeToUser(targetId, msg);
      break;
    }

    case "receipt": {
      const { senderId } = msg.payload;
      await routeToUser(senderId, msg);
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
}

/**
 * Route message across Redis or fallback to offline store
 */
export async function routeToUser(targetUserId: string, message: MessageSchema) {
  // If target user is online locally on this server, skip Redis roundtrip
  if (userSockets.has(targetUserId)) {
    broadcastToLocalUser(targetUserId, message);
    return;
  }

  // Check global online state across all server instances
  const isOnlineGlobally = await pub.sismember("presence:online", targetUserId);

  if (isOnlineGlobally) {
    // Target is connected to another cluster node: dispatch via Redis channel
    await pub.publish(
      "chat",
      JSON.stringify({ targetUserId, message })
    );
  } else {
    // User is completely offline: store in Redis offline queue
    await pub.rpush(`offline:${targetUserId}`, JSON.stringify(message));
  }
}

/**
 * Mock helper to route to members of a group
 */
async function routeToGroup(groupId: string, message: MessageSchema) {
  // Replace with actual database call: e.g. await db.getGroupMembers(groupId)
  const groupMembers = ["user_1", "user_2", "user_3"]; // get all group member

  for (const memberId of groupMembers) {
    await routeToUser(memberId, message);
  }
}

/**
 * Flush pending offline messages upon client reconnect
 */
export async function flushOfflineQueue(userId: string, ws: WS) {
  const offlineKey = `offline:${userId}`;
  const messages = await pub.lrange(offlineKey, 0, -1);

  if (messages.length > 0) {
    for (const msgStr of messages) {
      if (ws.readyState === 1) {
        ws.send(msgStr);
      }
    }
    // Purge queue after delivery
    await pub.del(offlineKey);
  }
}
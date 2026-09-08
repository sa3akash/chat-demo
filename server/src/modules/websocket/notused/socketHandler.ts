import Redis from "ioredis";
import { WS } from "../demo/socketStore";
import type { MessageSchema } from "../types";

// Unique identifier to prevent processing our own Redis pub/sub broadcasts
const INSTANCE_ID = Math.random().toString(36).substring(2, 9);

const pub = new Redis({ host: "localhost", port: 6379 });
const sub = pub.duplicate();

// Extract Elysia's internal WS type directly from a handler function

// Map storing active sockets grouped by user ID
export const userSockets = new Map<string, Set<WS>>();

// Helper to publish messages cross-instance
function publishCrossServer(userId: string, message: MessageSchema) {
  pub.publish(
    "chat",
    JSON.stringify({
      senderInstanceId: INSTANCE_ID,
      userId,
      message,
    })
  );
}

// Add connection to global presence
export async function addUser(userId: string, ws: WS) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.add(ws);
  } else {
    userSockets.set(userId, new Set([ws]));
    // First active socket for this user across this instance: mark online in Redis
    await pub.sadd(`presence:online`, userId);

    // Broadcast global presence update
    pub.publish(
      "chat",
      JSON.stringify({
        userId,
        message: {
          type: "presence",
          payload: { receiverId: userId, status: "online" },
        },
      })
    );
  }
}

// Send to local sockets belonging to a specific user
export function broadcastToLocalUser(userId: string, message: MessageSchema) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.forEach((socket) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(message));
      }
    });
  }
}

// Broadcast to ALL connected local users
export function broadcastToAllLocalSockets(message: MessageSchema) {
  userSockets.forEach((sockets) => {
    sockets.forEach((socket) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(message));
      }
    });
  });
}

export async function handleMessageRouting(userId: string, message: MessageSchema) {
  const localSockets = userSockets.get(userId);

  // Deliver locally if connected on this node
  if (localSockets && localSockets.size > 0) {
    broadcastToLocalUser(userId, message);
    return;
  }

  // Check if user is connected to ANY cluster instance
  const isOnlineGlobally = await pub.sismember("presence:online", userId);

  if (!isOnlineGlobally) {
    // User is completely offline: store in offline queue
    await pub.rpush(`offline:${userId}`, JSON.stringify(message));
  }
}

// Drain offline queue upon reconnect
export async function flushOfflineMessages(userId: string, ws: WS) {
  const messages = await pub.lrange(`offline:${userId}`, 0, -1);
  if (messages.length > 0) {
    for (const msgStr of messages) {
      ws.send(msgStr);
    }
    // Clear offline queue once sent
    await pub.del(`offline:${userId}`);
  }
}

// Remove connection from global presence
export async function disconnectUser(userId: string, ws: WS) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;

  sockets.delete(ws);
  if (sockets.size === 0) {
    userSockets.delete(userId);
    // User has no remaining active sockets on this instance
    await pub.srem(`presence:online`, userId);

    pub.publish(
      "chat",
      JSON.stringify({
        userId,
        message: {
          type: "presence",
          payload: { receiverId: userId, status: "offline" },
        },
      })
    );
  }
}

// ======= Redis Pub/Sub Subscriber Setup =======

sub.subscribe("chat", (err) => {
  if (err) {
    console.error("Failed to subscribe to Redis channel:", err);
  }
});

sub.on("message", (channel, rawData) => {
  if (channel === "chat") {
    try {
      const { senderInstanceId, userId, message } = JSON.parse(rawData) as {
        senderInstanceId: string;
        userId: string;
        message: MessageSchema;
      };

      // Avoid re-broadcasting messages originating from this instance
      if (senderInstanceId === INSTANCE_ID) return;

      broadcastToLocalUser(userId, message);
    } catch (err) {
      console.error("Failed to parse pub/sub message:", err);
    }
  }
});
import Redis from "ioredis";
import type { Elysia } from "elysia";
import { MessageSchema } from "./types";

export const pub = new Redis({ host: "localhost", port: 6379 });
export const sub = pub.duplicate();

// Extract Elysia internal WS type
export type WS = Parameters<
  NonNullable<Parameters<Elysia["ws"]>[1]["open"]>
>[0];

// In-memory socket store (Local to this node)
export const userSockets = new Map<string, Set<WS>>();

/**
 * Add local connection & update global Redis presence
 */
export async function addUser(userId: string, ws: WS) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.add(ws);
  } else {
    userSockets.set(userId, new Set([ws]));
    // Track globally in Redis
    await pub.sadd("presence:online", userId);

    // Notify cluster of user coming online
    await pub.publish(
      "chat",
      JSON.stringify({
        targetUserId: "*", // Global broadcast
        message: {
          type: "presence",
          payload: { userId, status: "online", lastSeen: Date.now() },
        },
      }),
    );
  }
}

/**
 * Remove connection & cleanup presence on disconnect
 */
export async function disconnectUser(userId: string, ws: WS) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;

  sockets.delete(ws);
  if (sockets.size === 0) {
    userSockets.delete(userId);

    // Remove global online status
    await pub.srem("presence:online", userId);

    // Notify cluster
    await pub.publish(
      "chat",
      JSON.stringify({
        targetUserId: "*",
        message: {
          type: "presence",
          payload: { userId, status: "offline", lastSeen: Date.now() },
        },
      }),
    );
  }
}

/**
 * Direct delivery to local sockets attached to this instance node
 */
export function broadcastToLocalUser(userId: string, message: MessageSchema,excludeSocketId?: string) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    const payloadStr = JSON.stringify(message);
    sockets.forEach((socket) => {
      if (socket.readyState === 1 && socket.id !== excludeSocketId) {
        socket.send(payloadStr);
      }
    });
  }
}

/**
 * Broadcast locally to all sockets connected to this instance node
 */
export function broadcastToAllLocal(message: MessageSchema) {
  const payloadStr = JSON.stringify(message);
  userSockets.forEach((sockets) => {
    sockets.forEach((socket) => {
      if (socket.readyState === 1) {
        socket.send(payloadStr);
      }
    });
  });
}



// --- Redis Pub/Sub Cluster Subscriber Listener ---
sub.subscribe("chat", (err) => {
  if (err) console.error("Redis sub failed:", err);
});

sub.on("message", (channel, payloadStr) => {
  if (channel !== "chat") return;

  try {
    const { targetUserId, message,excludeSocketId } = JSON.parse(payloadStr) as {
      targetUserId: string;
      message: MessageSchema;
      excludeSocketId?: string;
    };

    if (targetUserId === "*") {
      broadcastToAllLocal(message);
    } else {
      broadcastToLocalUser(targetUserId, message, excludeSocketId);
    }
  } catch (err) {
    console.error("Failed parsing pub/sub message payload:", err);
  }
});
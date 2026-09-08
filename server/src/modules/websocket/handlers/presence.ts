import {
  getAllOnlineUsers,
  publishPresence,
  refreshPresence,
  setUserOnline,
} from "../redis";
import { sendFrame, type WsContext } from "./context";
import type { S2C_PresenceInitial } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Presence & Heartbeat handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called once when a new WebSocket connection opens.
 * Registers the user as online and broadcasts the event to all nodes.
 */
export async function handleOpen(ws: WsContext["ws"], userId: string): Promise<void> {
  ws.subscribe(`user:${userId}`);
  ws.subscribe("presence");

  await setUserOnline(userId);

  // Send the full current online set to the newly connected client
  const onlineUserIds = await getAllOnlineUsers();
  const initial: S2C_PresenceInitial = { onlineUserIds };
  sendFrame(ws, "presence:initial", initial);

  await publishPresence("presence:update", { userId, status: "online" });
}

/**
 * `heartbeat` — refresh the 45-second Redis presence lease.
 */
export async function handleHeartbeat(
  ws: WsContext["ws"],
  userId: string
): Promise<void> {
  await refreshPresence(userId);
  sendFrame(ws, "heartbeat:ack", { timestamp: Date.now() });
}

/**
 * `presence:get` — return the current set of online user-ids to the requester.
 */
export async function handlePresenceGet(ws: WsContext["ws"]): Promise<void> {
  const onlineUserIds = await getAllOnlineUsers();
  sendFrame(ws, "presence:initial", { onlineUserIds } satisfies S2C_PresenceInitial);
}

/**
 * `room:join` — subscribe the socket to a conversation pub/sub topic.
 */
export function handleRoomJoin(
  ws: WsContext["ws"],
  conversationId: string
): void {
  if (conversationId) {
    ws.subscribe(`conversation:${conversationId}`);
  }
}

/**
 * `room:leave` — unsubscribe the socket from a conversation pub/sub topic.
 */
export function handleRoomLeave(
  ws: WsContext["ws"],
  conversationId: string
): void {
  if (conversationId) {
    ws.unsubscribe(`conversation:${conversationId}`);
  }
}

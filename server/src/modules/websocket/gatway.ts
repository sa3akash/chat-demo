/**
 * gateway.ts — WebSocket Gateway (orchestrator only)
 *
 * Responsibilities:
 *  - Authenticate incoming connections via JWT
 *  - Maintain a local socket registry for this node
 *  - Route each incoming message `type` to its dedicated handler
 *  - Expose the presence REST batch endpoint
 *
 * Business logic lives in: handlers/
 * Redis pub/sub setup lives in: redis.ts
 */

import Elysia, { t } from "elysia";
import { tokenEngine, type AuthPayload } from "@/middlewares/auth";
import { logger } from "@/lib/logger";
import {
  redisClient,
  publishPresence,
  setUserOffline,
  initRedis,
  setGatewayServer,
} from "./redis";
import {
  handleOpen,
  handleHeartbeat,
  handlePresenceGet,
  handleRoomJoin,
  handleRoomLeave,
  handleChatSend,
  handleTypingUpdate,
  handleReceiptRead,
  handleReactionUpdate,
  handleMessageDelete,
  handleCallInitiate,
  handleCallAccept,
  handleCallReject,
  handleCallEnd,
  handleCallIceCandidate,
  sendError,
  type WsContext,
} from "./handlers";
import {
  ChatSendPayload,
  TypingUpdatePayload,
  ReceiptReadPayload,
  ReactionUpdatePayload,
  MessageDeletePayload,
  RoomJoinPayload,
  RoomLeavePayload,
  CallInitiatePayload,
  CallAcceptPayload,
  CallRejectPayload,
  CallEndPayload,
  CallIceCandidatePayload,
  type TChatSend,
  type TTypingUpdate,
  type TReceiptRead,
  type TReactionUpdate,
  type TMessageDelete,
  type TRoomJoin,
  type TRoomLeave,
  type TCallInitiate,
  type TCallAccept,
  type TCallReject,
  type TCallEnd,
  type TCallIceCandidate,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Start Redis pub/sub on module load
// ─────────────────────────────────────────────────────────────────────────────

initRedis();

// Re-export so the app entry point can register the server reference
export { setGatewayServer };

// ─────────────────────────────────────────────────────────────────────────────
// Local node socket registry (userId → Set of WS connections)
// ─────────────────────────────────────────────────────────────────────────────

const localSockets = new Map<string, Set<any>>();

function trackSocket(userId: string, ws: any): void {
  let sockets = localSockets.get(userId);
  if (!sockets) {
    sockets = new Set();
    localSockets.set(userId, sockets);
  }
  sockets.add(ws);
}

function untrackSocket(userId: string, ws: any): void {
  const sockets = localSockets.get(userId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) localSockets.delete(userId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT verification
// ─────────────────────────────────────────────────────────────────────────────

function verifyToken(token: string): { userId: string; username: string } | null {
  try {
    const result = tokenEngine.decrypt<AuthPayload>(token);
    if (result.success && result.data?.id) {
      return { userId: result.data.id, username: result.data.username ?? "User" };
    }
  } catch (err) {
    logger.warn({ err }, "WS token verification failed");
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Elysia scoped auth derive
// ─────────────────────────────────────────────────────────────────────────────

const wsAuth = new Elysia({ name: "ws-auth" }).derive(
  { as: "scoped" },
  async ({ query, status }) => {
    const data = verifyToken(query.token);
    if (!data) return status(401);
    return { userId: data.userId, username: data.username };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Presence batch REST endpoint
// ─────────────────────────────────────────────────────────────────────────────

export const presenceApi = new Elysia({ prefix: "/api" }).post(
  "/presence/batch",
  async ({ body }: { body: { userIds: string[] } }) => {
    if (!body.userIds?.length) return { online: [] };
    const targetIds = body.userIds.slice(0, 200);
    try {
      const results = await redisClient.mget(targetIds.map((id) => `presence:${id}`));
      const online: string[] = [];
      results.forEach((val, idx) => { if (val !== null) online.push(targetIds[idx]); });
      return { online };
    } catch (err: any) {
      logger.error({ err: err.message }, "Presence batch lookup failed");
      return { online: [] };
    }
  },
  { body: t.Object({ userIds: t.Array(t.String()) }) }
);

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket gateway
// ─────────────────────────────────────────────────────────────────────────────

export const websocket = new Elysia()
  .use(wsAuth)
  .use(presenceApi)
  .ws("/ws", {
    query: t.Object({ token: t.String() }),
    body: t.Object({ type: t.String(), payload: t.Optional(t.Any()) }),

    // ── Connection opened ──────────────────────────────────────────────────
    async open(ws) {
      const userId = ws.data.userId as string;
      trackSocket(userId, ws);
      try {
        await handleOpen(ws, userId);
      } catch (err: any) {
        logger.error({ err: err.message, userId }, "Error on WS open");
      }
    },

    // ── Incoming message — pure routing table ──────────────────────────────
    async message(ws, message) {
      const senderId = ws.data.userId as string;
      const username  = ws.data.username as string;
      const { type, payload = {} } = message;

      const ctx: WsContext = { ws, senderId, username };

      try {
        switch (type) {
          // ── Presence & rooms ────────────────────────────────────────────
          case "heartbeat":
            await handleHeartbeat(ctx.ws, senderId);
            break;

          case "presence:get":
            await handlePresenceGet(ctx.ws);
            break;

          case "room:join":
            handleRoomJoin(ctx.ws, (payload as TRoomJoin).conversationId);
            break;

          case "room:leave":
            handleRoomLeave(ctx.ws, (payload as TRoomLeave).conversationId);
            break;

          // ── Chat ────────────────────────────────────────────────────────
          case "chat:send":
          case "send_message": // backward-compat alias
            await handleChatSend(ctx, payload as TChatSend);
            break;

          // ── Typing ──────────────────────────────────────────────────────
          case "typing:update":
            await handleTypingUpdate(ctx, payload as TTypingUpdate);
            break;

          // ── Receipts ────────────────────────────────────────────────────
          case "receipt:read":
            await handleReceiptRead(ctx, payload as TReceiptRead);
            break;

          // ── Reactions ───────────────────────────────────────────────────
          case "reaction:update":
            await handleReactionUpdate(ctx, payload as TReactionUpdate);
            break;

          // ── Message delete ──────────────────────────────────────────────
          case "message:delete":
            await handleMessageDelete(ctx, payload as TMessageDelete);
            break;

          // ── WebRTC signaling ────────────────────────────────────────────
          case "call:initiate":
            await handleCallInitiate(ctx, payload as TCallInitiate);
            break;

          case "call:accept":
            await handleCallAccept(ctx, payload as TCallAccept);
            break;

          case "call:reject":
            await handleCallReject(ctx, payload as TCallReject);
            break;

          case "call:end":
            await handleCallEnd(ctx, payload as TCallEnd);
            break;

          case "call:ice-candidate":
            await handleCallIceCandidate(ctx, payload as TCallIceCandidate);
            break;

          default:
            logger.warn({ type, senderId }, "Unknown WS message type");
        }
      } catch (err: any) {
        logger.error({ err: err.message, type, senderId }, "Error processing WS message");
        sendError(ctx.ws, "SERVER_ERROR", "Failed to process message");
      }
    },

    // ── Connection closed ──────────────────────────────────────────────────
    async close(ws) {
      const userId = ws.data.userId as string;
      untrackSocket(userId, ws);
      ws.unsubscribe(`user:${userId}`);
      ws.unsubscribe("presence");

      try {
        // Decrement connection count; broadcast offline only when last tab closes
        const remaining = await redisClient.decr(`connections:${userId}`);
        if (remaining <= 0) {
          await redisClient.del(`connections:${userId}`);
          await setUserOffline(userId);
          await publishPresence("presence:update", {
            userId,
            status: "offline",
            lastSeen: Date.now(),
          });
        }
      } catch (err: any) {
        logger.error({ err: err.message, userId }, "Error on WS close");
      }
    },
  });

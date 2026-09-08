import { publishToUser } from "../redis";
import type {
  TCallInitiate,
  TCallAccept,
  TCallReject,
  TCallEnd,
  TCallIceCandidate,
  S2C_CallIncoming,
  S2C_CallAccepted,
  S2C_CallRejected,
  S2C_CallEnded,
  S2C_CallIceCandidate,
} from "../types";
import type { WsContext } from "./context";

// ─────────────────────────────────────────────────────────────────────────────
// WebRTC call signaling handlers (no DB writes — all ephemeral)
// ─────────────────────────────────────────────────────────────────────────────

/** `call:initiate` — caller sends SDP offer to recipient */
export async function handleCallInitiate(
  ctx: WsContext,
  payload: TCallInitiate
): Promise<void> {
  const { recipientId, conversationId, callType = "audio", offer } = payload;
  if (!recipientId) return;

  const incoming: S2C_CallIncoming = {
    conversationId,
    callerId: ctx.senderId,
    callerName: ctx.username,
    callType,
    offer,
  };
  await publishToUser(recipientId, "call:incoming", incoming);
}

/** `call:accept` — callee sends SDP answer back to caller */
export async function handleCallAccept(
  ctx: WsContext,
  payload: TCallAccept
): Promise<void> {
  const { callerId, conversationId, answer } = payload;
  if (!callerId) return;

  const accepted: S2C_CallAccepted = {
    conversationId,
    calleeId: ctx.senderId,
    calleeName: ctx.username,
    answer,
  };
  await publishToUser(callerId, "call:accepted", accepted);
}

/** `call:reject` — callee declines the incoming call */
export async function handleCallReject(
  ctx: WsContext,
  payload: TCallReject
): Promise<void> {
  const { callerId, conversationId } = payload;
  if (!callerId) return;

  const rejected: S2C_CallRejected = { conversationId, calleeId: ctx.senderId };
  await publishToUser(callerId, "call:rejected", rejected);
}

/** `call:end` — either party terminates the active call */
export async function handleCallEnd(
  ctx: WsContext,
  payload: TCallEnd
): Promise<void> {
  const { targetUserId, conversationId } = payload;
  if (!targetUserId) return;

  const ended: S2C_CallEnded = { conversationId, userId: ctx.senderId };
  await publishToUser(targetUserId, "call:ended", ended);
}

/** `call:ice-candidate` — trickle ICE candidate exchange */
export async function handleCallIceCandidate(
  ctx: WsContext,
  payload: TCallIceCandidate
): Promise<void> {
  const { targetUserId, conversationId, candidate } = payload;
  if (!targetUserId || !candidate) return;

  const icePayload: S2C_CallIceCandidate = {
    conversationId,
    senderId: ctx.senderId,
    candidate,
  };
  await publishToUser(targetUserId, "call:ice-candidate", icePayload);
}

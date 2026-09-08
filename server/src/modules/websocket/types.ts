import { t, type Static } from "elysia";

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

export const AttachmentSchema = t.Object({
  url: t.String(),
  name: t.String(),
  mimeType: t.String(),
});

export const PublicUserSchema = t.Object({
  id: t.String(),
  username: t.String(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Client → Server (inbound) payloads
// ─────────────────────────────────────────────────────────────────────────────

/** `heartbeat` — keep-alive ping */
export const HeartbeatPayload = t.Object({});

/** `presence:get` — request current online set */
export const PresenceGetPayload = t.Object({});

/** `room:join` — subscribe to a conversation topic */
export const RoomJoinPayload = t.Object({
  conversationId: t.String(),
});

/** `room:leave` — unsubscribe from a conversation topic */
export const RoomLeavePayload = t.Object({
  conversationId: t.String(),
});

/** `chat:send` — send a new message */
export const ChatSendPayload = t.Object({
  conversationId: t.String(),
  content: t.String(),
  type: t.Optional(t.String()),
  tempId: t.Optional(t.String()),
  replyToId: t.Optional(t.Nullable(t.String())),
  attachments: t.Optional(t.Array(AttachmentSchema)),
});

/** `typing:update` — start / stop typing indicator */
export const TypingUpdatePayload = t.Object({
  conversationId: t.String(),
  isTyping: t.Boolean(),
});

/** `receipt:read` — mark conversation as read */
export const ReceiptReadPayload = t.Object({
  conversationId: t.String(),
  messageId: t.Optional(t.Nullable(t.String())),
});

/** `reaction:update` — add or toggle-off an emoji reaction */
export const ReactionUpdatePayload = t.Object({
  conversationId: t.String(),
  messageId: t.String(),
  emoji: t.String(),
});

/** `message:delete` — delete a message for everyone */
export const MessageDeletePayload = t.Object({
  conversationId: t.String(),
  messageId: t.String(),
});

// ── WebRTC Signaling ────────────────────────────────────────────────────────

export const RTCSessionDescriptionSchema = t.Object({
  type: t.Union([
    t.Literal("offer"),
    t.Literal("answer"),
    t.Literal("pranswer"),
    t.Literal("rollback"),
  ]),
  sdp: t.Optional(t.String()),
});

export const RTCIceCandidateSchema = t.Object({
  candidate: t.String(),
  sdpMid: t.Optional(t.Nullable(t.String())),
  sdpMLineIndex: t.Optional(t.Nullable(t.Number())),
  usernameFragment: t.Optional(t.Nullable(t.String())),
});

/** `call:initiate` — caller sends offer to recipient */
export const CallInitiatePayload = t.Object({
  recipientId: t.String(),
  conversationId: t.String(),
  callType: t.Optional(t.Union([t.Literal("audio"), t.Literal("video")])),
  offer: RTCSessionDescriptionSchema,
});

/** `call:accept` — callee accepts and sends answer to caller */
export const CallAcceptPayload = t.Object({
  callerId: t.String(),
  conversationId: t.String(),
  answer: RTCSessionDescriptionSchema,
});

/** `call:reject` — callee declines incoming call */
export const CallRejectPayload = t.Object({
  callerId: t.String(),
  conversationId: t.String(),
});

/** `call:end` — either party ends the active call */
export const CallEndPayload = t.Object({
  targetUserId: t.String(),
  conversationId: t.String(),
});

/** `call:ice-candidate` — ICE candidate exchange */
export const CallIceCandidatePayload = t.Object({
  targetUserId: t.String(),
  conversationId: t.String(),
  candidate: RTCIceCandidateSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Discriminated union — used as the WS body schema in Elysia
// ─────────────────────────────────────────────────────────────────────────────

export const ClientMessageSchema = t.Object({
  type: t.String(),
  payload: t.Optional(t.Any()),
});

// ─────────────────────────────────────────────────────────────────────────────
// Server → Client event payloads (outbound)
// ─────────────────────────────────────────────────────────────────────────────

export interface S2C_PresenceInitial {
  onlineUserIds: string[];
}

export interface S2C_PresenceUpdate {
  userId: string;
  status: "online" | "offline";
  lastSeen?: number;
}

export interface S2C_HeartbeatAck {
  timestamp: number;
}

export interface S2C_ChatNew {
  id: string;
  tempId?: string;
  conversationId: string;
  content: string;
  type: string;
  senderId: string;
  sender: { id: string; username: string };
  replyToId: string | null;
  attachments: Static<typeof AttachmentSchema>[];
  reactions: Record<string, string[]>;
  createdAt: string;
}

export interface S2C_ChatAck {
  tempId?: string;
  messageId: string;
  conversationId: string;
  createdAt: string;
}

export interface S2C_TypingUpdate {
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface S2C_ReceiptRead {
  conversationId: string;
  userId: string;
  messageId?: string | null;
  readAt: string;
}

export interface S2C_ReactionUpdate {
  conversationId: string;
  messageId: string;
  reactions: Record<string, string[]>;
  userId: string;
  emoji: string;
}

export interface S2C_MessageDelete {
  conversationId: string;
  messageId: string;
}

export interface S2C_ConversationUpdate {
  conversationId: string;
  latestMessage?: S2C_ChatNew;
  lastMessageAt?: string;
  unreadCount?: number;
}

export interface S2C_CallIncoming {
  conversationId: string;
  callerId: string;
  callerName: string;
  callType: "audio" | "video";
  offer: RTCSessionDescriptionInit;
}

export interface S2C_CallAccepted {
  conversationId: string;
  calleeId: string;
  calleeName: string;
  answer: RTCSessionDescriptionInit;
}

export interface S2C_CallRejected {
  conversationId: string;
  calleeId: string;
}

export interface S2C_CallEnded {
  conversationId: string;
  userId: string;
}

export interface S2C_CallIceCandidate {
  conversationId: string;
  senderId: string;
  candidate: RTCIceCandidateInit;
}

export interface S2C_Error {
  code: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static TypeScript types for inbound payloads
// ─────────────────────────────────────────────────────────────────────────────

export type TAttachment      = Static<typeof AttachmentSchema>;
export type TPublicUser      = Static<typeof PublicUserSchema>;
export type TChatSend        = Static<typeof ChatSendPayload>;
export type TTypingUpdate    = Static<typeof TypingUpdatePayload>;
export type TReceiptRead     = Static<typeof ReceiptReadPayload>;
export type TReactionUpdate  = Static<typeof ReactionUpdatePayload>;
export type TMessageDelete   = Static<typeof MessageDeletePayload>;
export type TRoomJoin        = Static<typeof RoomJoinPayload>;
export type TRoomLeave       = Static<typeof RoomLeavePayload>;
export type TCallInitiate    = Static<typeof CallInitiatePayload>;
export type TCallAccept      = Static<typeof CallAcceptPayload>;
export type TCallReject      = Static<typeof CallRejectPayload>;
export type TCallEnd         = Static<typeof CallEndPayload>;
export type TCallIceCandidate = Static<typeof CallIceCandidatePayload>;
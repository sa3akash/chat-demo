import { t, Static } from "elysia";

// --- Base Schemas ---

export const chatPayload = t.Object({
  id: t.String(),
  conversationId: t.String(),
  senderId: t.String(),
  senderName: t.Optional(t.String()),
  receiverId: t.Optional(t.String()), // Set for 1-on-1
  groupId: t.Optional(t.String()), // Set for Group
  text: t.Optional(t.String()),
  mediaUrl: t.Optional(t.String()),
  mediaType: t.Optional(
    t.Union([
      t.Literal("image"),
      t.Literal("video"),
      t.Literal("audio"),
      t.Literal("file"),
    ]),
  ),
  replyToId: t.Optional(t.String()),
  createdAt: t.Number(),
});

export const statusReceiptPayload = t.Object({
  messageId: t.Optional(t.String()),
  conversationId: t.String(),
  senderId: t.String(), // User who read/received
  status: t.Union([t.Literal("delivered"), t.Literal("read")]),
  timestamp: t.Number(),
});

export const typingPayload = t.Object({
  conversationId: t.String(),
  senderId: t.String(),
  senderName: t.Optional(t.String()),
  targetId: t.String(), // receiverId or conversationId
  isTyping: t.Boolean(),
});

export const reactionPayload = t.Object({
  messageId: t.String(),
  conversationId: t.String(),
  userId: t.String(),
  targetUserId: t.String(),
  emoji: t.String(),
  action: t.Union([t.Literal("add"), t.Literal("remove")]),
});

export const presencePayload = t.Object({
  userId: t.String(),
  username: t.Optional(t.String()),
  status: t.Union([
    t.Literal("online"),
    t.Literal("offline"),
    t.Literal("away"),
    t.Literal("dnd"),
  ]),
  lastSeen: t.Optional(t.Number()),
});

export const heartbeatPayload = t.Object({});

export const groupActionPayload = t.Object({
  groupId: t.String(),
  action: t.Union([
    t.Literal("member_added"),
    t.Literal("member_removed"),
    t.Literal("renamed"),
    t.Literal("role_changed"),
  ]),
  operatorId: t.String(),
  memberIds: t.Array(t.String()),
});

export const notificationPayload = t.Object({
  id: t.String(),
  userId: t.String(),
  actorId: t.Optional(t.String()),
  actorName: t.Optional(t.String()),
  type: t.String(),
  title: t.String(),
  body: t.String(),
  link: t.Optional(t.String()),
  createdAt: t.Number(),
});

// --- Discriminated Union ---

export const messageSchema = t.Union([
  t.Object({ type: t.Literal("chat"), payload: chatPayload }),
  t.Object({ type: t.Literal("receipt"), payload: statusReceiptPayload }),
  t.Object({ type: t.Literal("typing"), payload: typingPayload }),
  t.Object({ type: t.Literal("reaction"), payload: reactionPayload }),
  t.Object({ type: t.Literal("presence"), payload: presencePayload }),
  t.Object({ type: t.Literal("group_action"), payload: groupActionPayload }),
  t.Object({ type: t.Literal("notification"), payload: notificationPayload }),
  t.Object({ type: t.Literal("heartbeat"), payload: heartbeatPayload }),
]);

export type MessageSchema = Static<typeof messageSchema>;
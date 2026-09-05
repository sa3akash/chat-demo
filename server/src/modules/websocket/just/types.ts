import { t, Static } from "elysia";



// --- Base Schemas ---

export const chatPayload = t.Object({
  id: t.String(), // UUIDv7 or ULID (time-sortable)
  conversationId: t.String(),
  senderId: t.String(),
  receiverId: t.Optional(t.String()), // Set for 1-on-1
  groupId: t.Optional(t.String()),    // Set for Group
  text: t.Optional(t.String()),
  mediaUrl: t.Optional(t.String()),
  mediaType: t.Optional(
    t.Union([
      t.Literal("image"),
      t.Literal("video"),
      t.Literal("audio"),
      t.Literal("file"),
    ])
  ),
  replyToId: t.Optional(t.String()),
  createdAt: t.Number(),
});

export const statusReceiptPayload = t.Object({
  messageId: t.String(),
  conversationId: t.String(),
  senderId: t.String(), // Target recipient receiving the state update
  status: t.Union([t.Literal("delivered"), t.Literal("read")]),
  timestamp: t.Number(),
});

export const typingPayload = t.Object({
  conversationId: t.String(),
  senderId: t.String(),
  targetId: t.String(), // receiverId or groupId
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
  status: t.Union([
    t.Literal("online"),
    t.Literal("offline"),
    t.Literal("away"),
  ]),
  lastSeen: t.Optional(t.Number()),
});

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

// --- Discriminated Union ---

export const messageSchema = t.Union([
  t.Object({ type: t.Literal("chat"), payload: chatPayload }),
  t.Object({ type: t.Literal("receipt"), payload: statusReceiptPayload }),
  t.Object({ type: t.Literal("typing"), payload: typingPayload }),
  t.Object({ type: t.Literal("reaction"), payload: reactionPayload }),
  t.Object({ type: t.Literal("presence"), payload: presencePayload }),
  t.Object({ type: t.Literal("group_action"), payload: groupActionPayload }),
]);

export type MessageSchema = Static<typeof messageSchema>;
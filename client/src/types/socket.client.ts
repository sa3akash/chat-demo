// types/socket.client.ts

export type MediaType = "image" | "video" | "audio" | "file";
export type ReceiptStatus = "delivered" | "read";
export type ReactionAction = "add" | "remove";
export type PresenceStatus = "online" | "offline" | "away" | "dnd";
export type GroupAction = "member_added" | "member_removed" | "renamed" | "role_changed";

export interface ChatPayload {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  receiverId?: string;
  groupId?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  replyToId?: string;
  createdAt: number;
}

export interface StatusReceiptPayload {
  messageId?: string;
  conversationId: string;
  senderId: string;
  status: ReceiptStatus;
  timestamp: number;
}

export interface TypingPayload {
  conversationId: string;
  senderId: string;
  senderName?: string;
  targetId: string;
  isTyping: boolean;
}

export interface ReactionPayload {
  messageId: string;
  conversationId: string;
  userId: string;
  targetUserId: string;
  emoji: string;
  action: ReactionAction;
}

export interface PresencePayload {
  userId: string;
  username?: string;
  status: PresenceStatus;
  lastSeen?: number;
}

export interface GroupActionPayload {
  groupId: string;
  action: GroupAction;
  operatorId: string;
  memberIds: string[];
}

export interface NotificationPayload {
  id: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  createdAt: number;
}

// Complete map of all client events to their payloads
export interface SocketPayloadMap {
  chat: ChatPayload;
  receipt: StatusReceiptPayload;
  typing: TypingPayload;
  reaction: ReactionPayload;
  presence: PresencePayload;
  group_action: GroupActionPayload;
  notification: NotificationPayload;
}

export type SocketEventType = keyof SocketPayloadMap;

export type ClientSocketMessage = {
  [K in SocketEventType]: {
    type: K;
    payload: SocketPayloadMap[K];
  };
}[SocketEventType];
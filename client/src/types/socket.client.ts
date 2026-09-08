// types/socket.client.ts

export type MessageDeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface MessageSender {
  id: string;
  username: string;
  email?: string;
}

export interface MessageAttachment {
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface SocketMessage {
  id: string;
  tempId?: string;
  conversationId: string;
  content: string;
  type: string; // "text" | "image" | "video" | "audio" | "file"
  senderId: string;
  sender?: MessageSender | null;
  replyToId?: string | null;
  attachments?: MessageAttachment[];
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  deletedForEveryone?: boolean;
  createdAt: string;
  status?: MessageDeliveryStatus;
}

export interface ChatAckPayload {
  tempId?: string;
  messageId: string;
  conversationId: string;
  createdAt: string;
}

export interface TypingUpdatePayload {
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface ReceiptReadPayload {
  conversationId: string;
  userId: string;
  messageId?: string;
  readAt: string;
}

export interface ReactionUpdatePayload {
  conversationId: string;
  messageId: string;
  reactions: Record<string, string[]>;
  userId: string;
  emoji: string;
}

export interface MessageDeletePayload {
  conversationId: string;
  messageId: string;
}

export interface ConversationUpdatePayload {
  conversationId: string;
  latestMessage?: SocketMessage;
  lastMessageAt?: string;
  unreadCount?: number;
}

export interface PresenceInitialPayload {
  onlineUserIds: string[];
}

export interface PresenceUpdatePayload {
  userId: string;
  status: "online" | "offline";
  lastSeen?: number;
}

export interface IncomingCallPayload {
  conversationId: string;
  callerId: string;
  callerName: string;
  callType: "audio" | "video";
  offer?: any;
}

export interface CallAcceptedPayload {
  conversationId: string;
  calleeId: string;
  calleeName: string;
  answer?: any;
}

export interface CallRejectedPayload {
  conversationId: string;
  calleeId: string;
}

export interface CallEndedPayload {
  conversationId: string;
  userId: string;
}

export interface CallIceCandidatePayload {
  conversationId?: string;
  senderId: string;
  candidate: any;
}

export interface RoomActionPayload {
  conversationId: string;
}

export interface SocketErrorPayload {
  code: string;
  message: string;
}

// Map of server-to-client event names to payloads
export interface ServerToClientEvents {
  "chat:new": SocketMessage;
  "chat:ack": ChatAckPayload;
  "typing:update": TypingUpdatePayload;
  "receipt:read": ReceiptReadPayload;
  "reaction:update": ReactionUpdatePayload;
  "message:delete": MessageDeletePayload;
  "conversation:update": ConversationUpdatePayload;
  "presence:initial": PresenceInitialPayload;
  "presence:update": PresenceUpdatePayload;
  "call:incoming": IncomingCallPayload;
  "call:accepted": CallAcceptedPayload;
  "call:rejected": CallRejectedPayload;
  "call:ended": CallEndedPayload;
  "call:ice-candidate": CallIceCandidatePayload;
  "heartbeat:ack": { timestamp: number };
  "error": SocketErrorPayload;
}

// Map of client-to-server event names to payloads
export interface ClientToServerEvents {
  "chat:send": {
    conversationId: string;
    content: string;
    type?: string;
    tempId?: string;
    replyToId?: string | null;
    attachments?: MessageAttachment[];
  };
  "room:join": RoomActionPayload;
  "room:leave": RoomActionPayload;
  "typing:update": {
    conversationId: string;
    isTyping: boolean;
  };
  "receipt:read": {
    conversationId: string;
    messageId?: string;
  };
  "reaction:update": {
    conversationId: string;
    messageId: string;
    emoji: string;
  };
  "message:delete": {
    conversationId: string;
    messageId: string;
  };
  "presence:get": Record<string, never>;
  "call:initiate": {
    recipientId: string;
    conversationId: string;
    callType: "audio" | "video";
    offer?: any;
  };
  "call:accept": {
    callerId: string;
    conversationId: string;
    answer?: any;
  };
  "call:reject": {
    callerId: string;
    conversationId: string;
  };
  "call:end": {
    targetUserId: string;
    conversationId: string;
  };
  "call:ice-candidate": {
    targetUserId: string;
    candidate: any;
    conversationId?: string;
  };
  "heartbeat": Record<string, never>;
}
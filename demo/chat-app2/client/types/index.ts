export type User = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  online?: boolean;
};

export type Reaction = {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: { id: string; username: string; avatarUrl?: string | null };
  reactions?: Reaction[];
  tempId?: string;
  pending?: boolean;
};

export type Conversation = {
  id: string;
  type: "DIRECT" | "GROUP";
  name: string | null;
  avatarUrl: string | null;
  updatedAt: string;
  lastMessage: Message | null;
  members: User[];
};

export type ServerEvent =
  | { type: "connected"; userId: string }
  | { type: "message:new"; message: Message }
  | { type: "message:ack"; tempId: string; message: Message }
  | { type: "presence:bulk"; statuses: Record<string, boolean> }
  | { type: "presence:update"; userId: string; status: "online" | "offline"; lastSeenAt?: string }
  | { type: "typing:update"; conversationId: string; userId: string; isTyping: boolean }
  | { type: "read:update"; conversationId: string; userId: string; lastReadMessageId: string }
  | { type: "reaction:update"; conversationId: string; messageId: string; reactions: Reaction[] }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "message:send"; conversationId: string; content: string; tempId: string }
  | { type: "typing:start" | "typing:stop"; conversationId: string }
  | { type: "conversation:join"; conversationId: string }
  | { type: "presence:ping" }
  | { type: "message:read"; conversationId: string; messageId: string }
  | { type: "reaction:add"; conversationId: string; messageId: string; emoji: string }
  | { type: "reaction:remove"; conversationId: string; messageId: string };

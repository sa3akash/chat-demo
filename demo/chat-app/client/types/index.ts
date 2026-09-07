export type User = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  online?: boolean;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: { id: string; username: string; avatarUrl?: string | null };
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
  | { type: "presence:update"; userId: string; status: "online" | "offline" }
  | { type: "typing:update"; conversationId: string; userId: string; isTyping: boolean }
  | { type: "error"; message: string };

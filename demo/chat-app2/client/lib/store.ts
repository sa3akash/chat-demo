"use client";

import { create } from "zustand";
import type { Conversation, Message, Reaction, ServerEvent } from "@/types";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

type ReadReceipt = { userId: string; lastReadMessageId: string };

type ChatState = {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  typingByConversation: Record<string, Set<string>>;
  onlineUserIds: Set<string>;
  lastSeenByUser: Record<string, string>;
  readReceiptsByConversation: Record<string, ReadReceipt[]>;
  connectionStatus: ConnectionStatus;
  activeConversationId: string | null;

  setConversations: (c: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  prependMessages: (conversationId: string, messages: Message[]) => void;
  addOptimisticMessage: (message: Message) => void;
  setConnectionStatus: (s: ConnectionStatus) => void;
  handleServerEvent: (event: ServerEvent) => void;
};

function applyReactions(messages: Message[], messageId: string, reactions: Reaction[]) {
  return messages.map((m) => (m.id === messageId ? { ...m, reactions } : m));
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  messagesByConversation: {},
  typingByConversation: {},
  onlineUserIds: new Set(),
  lastSeenByUser: {},
  readReceiptsByConversation: {},
  connectionStatus: "connecting",
  activeConversationId: null,

  setConversations: (conversations) =>
    set((state) => {
      // Seed presence from the REST snapshot (each member carries an
      // `online` flag) so the UI isn't blank before the WS presence:bulk
      // event arrives — then presence:bulk / presence:update take over.
      const next = new Set(state.onlineUserIds);
      conversations.forEach((c) => c.members.forEach((m) => m.online && next.add(m.id)));
      return { conversations, onlineUserIds: next };
    }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: { ...state.messagesByConversation, [conversationId]: messages },
    })),

  prependMessages: (conversationId, older) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] ?? [];
      return {
        messagesByConversation: { ...state.messagesByConversation, [conversationId]: [...older, ...existing] },
      };
    }),

  addOptimisticMessage: (message) =>
    set((state) => {
      const existing = state.messagesByConversation[message.conversationId] ?? [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [message.conversationId]: [...existing, message],
        },
      };
    }),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  handleServerEvent: (event) => {
    switch (event.type) {
      case "message:new": {
        const { conversationId } = event.message;
        set((state) => {
          const existing = state.messagesByConversation[conversationId] ?? [];
          const withoutTemp = existing.filter((m) => m.id !== event.message.id);
          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [conversationId]: [...withoutTemp, event.message],
            },
          };
        });
        break;
      }

      case "message:ack": {
        set((state) => {
          const conversationId = event.message.conversationId;
          const existing = state.messagesByConversation[conversationId] ?? [];
          const reconciled = existing.map((m) =>
            m.tempId === event.tempId ? { ...event.message, pending: false } : m
          );
          return {
            messagesByConversation: { ...state.messagesByConversation, [conversationId]: reconciled },
          };
        });
        break;
      }

      // One-time snapshot right after connecting — see ws.gateway.ts `open`.
      // This is what makes "who's online" correct on load instead of only
      // updating for people who happen to connect/disconnect afterward.
      case "presence:bulk": {
        set((state) => {
          const next = new Set(state.onlineUserIds);
          Object.entries(event.statuses).forEach(([userId, online]) => {
            if (online) next.add(userId);
            else next.delete(userId);
          });
          return { onlineUserIds: next };
        });
        break;
      }

      case "presence:update": {
        set((state) => {
          const next = new Set(state.onlineUserIds);
          if (event.status === "online") next.add(event.userId);
          else next.delete(event.userId);
          return {
            onlineUserIds: next,
            lastSeenByUser: event.lastSeenAt
              ? { ...state.lastSeenByUser, [event.userId]: event.lastSeenAt }
              : state.lastSeenByUser,
          };
        });
        break;
      }

      case "typing:update": {
        set((state) => {
          const current = new Set(state.typingByConversation[event.conversationId] ?? []);
          if (event.isTyping) current.add(event.userId);
          else current.delete(event.userId);
          return {
            typingByConversation: { ...state.typingByConversation, [event.conversationId]: current },
          };
        });
        break;
      }

      case "read:update": {
        set((state) => {
          const existing = state.readReceiptsByConversation[event.conversationId] ?? [];
          const withoutUser = existing.filter((r) => r.userId !== event.userId);
          return {
            readReceiptsByConversation: {
              ...state.readReceiptsByConversation,
              [event.conversationId]: [...withoutUser, { userId: event.userId, lastReadMessageId: event.lastReadMessageId }],
            },
          };
        });
        break;
      }

      case "reaction:update": {
        set((state) => {
          const existing = state.messagesByConversation[event.conversationId] ?? [];
          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [event.conversationId]: applyReactions(existing, event.messageId, event.reactions),
            },
          };
        });
        break;
      }
    }
  },
}));

"use client";

import { create } from "zustand";
import type { Conversation, Message, ServerEvent } from "@/types";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

type ChatState = {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  typingByConversation: Record<string, Set<string>>;
  onlineUserIds: Set<string>;
  connectionStatus: ConnectionStatus;
  activeConversationId: string | null;

  setConversations: (c: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addOptimisticMessage: (message: Message) => void;
  setConnectionStatus: (s: ConnectionStatus) => void;
  handleServerEvent: (event: ServerEvent) => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messagesByConversation: {},
  typingByConversation: {},
  onlineUserIds: new Set(),
  connectionStatus: "connecting",
  activeConversationId: null,

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: { ...state.messagesByConversation, [conversationId]: messages },
    })),

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
          // Avoid duplicating a message we already added optimistically.
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

      case "presence:update": {
        set((state) => {
          const next = new Set(state.onlineUserIds);
          if (event.status === "online") next.add(event.userId);
          else next.delete(event.userId);
          return { onlineUserIds: next };
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
    }
  },
}));

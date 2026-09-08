"use client";

import React, { useEffect, useState, useMemo } from "react";
import { IConversation } from "@/types/conversation";
import SingleConversation from "./items/SingleConversation";
import { useSocket } from "@/context/SocketContext";
import { ConversationUpdatePayload, ReceiptReadPayload } from "@/types/socket.client";

interface ConversationListProps {
  initialConversations: IConversation[];
  activeConversationId?: string;
  searchQuery?: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  initialConversations,
  activeConversationId,
  searchQuery = "",
}) => {
  const [conversations, setConversations] = useState<IConversation[]>(initialConversations);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "direct" | "groups">("all");
  const { isUserOnline, checkPresence, subscribe } = useSocket();

  // Sync with initial server props
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  // Check presence of all conversation participants on mount
  useEffect(() => {
    const userIds = conversations
      .map((c) => c.otherUser?.id)
      .filter((id): id is string => Boolean(id));

    if (userIds.length > 0) {
      checkPresence(userIds);
    }
  }, [conversations, checkPresence]);

  // Listen to real-time conversation updates
  useEffect(() => {
    const unsubConvUpdate = subscribe(
      "conversation:update",
      (data: ConversationUpdatePayload) => {
        setConversations((prev) => {
          const index = prev.findIndex((c) => c.id === data.conversationId);
          if (index === -1) return prev;

          const existing = prev[index];
          const isActive = data.conversationId === activeConversationId;

          const updated: IConversation = {
            ...existing,
            lastMessageAt: data.lastMessageAt || existing.lastMessageAt,
            unreadCount:
              data.unreadCount !== undefined
                ? data.unreadCount
                : isActive
                ? 0
                : existing.unreadCount + 1,
            latestMessage: data.latestMessage
              ? {
                  id: data.latestMessage.id,
                  content: data.latestMessage.content,
                  type: data.latestMessage.type,
                  conversationId: data.latestMessage.conversationId,
                  createdAt: data.latestMessage.createdAt,
                  updatedAt: data.latestMessage.createdAt,
                  attachments: [],
                  sender: {
                    id: data.latestMessage.senderId,
                    username: data.latestMessage.sender?.username || "User",
                    email: data.latestMessage.sender?.email || "",
                  },
                }
              : existing.latestMessage,
          };

          // Reorder: move updated conversation to top of list
          const next = [...prev];
          next.splice(index, 1);
          return [updated, ...next];
        });
      }
    );

    const unsubRead = subscribe("receipt:read", (data: ReceiptReadPayload) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === data.conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
    });

    return () => {
      unsubConvUpdate();
      unsubRead();
    };
  }, [subscribe, activeConversationId]);

  // Filter conversations based on query and tab
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const title = c.otherUser?.username || c.title || "";
      const latestText = c.latestMessage?.content || "";
      const matchesSearch =
        !searchQuery.trim() ||
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        latestText.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === "unread") return c.unreadCount > 0;
      if (activeTab === "direct") return c.type === "direct";
      if (activeTab === "groups") return c.type === "group";

      return true;
    });
  }, [conversations, searchQuery, activeTab]);

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Category Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl text-xs font-medium shrink-0">
        {(
          [
            { key: "all", label: "All" },
            { key: "unread", label: "Unread" },
            { key: "direct", label: "Direct" },
            { key: "groups", label: "Groups" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-1 rounded-lg text-center transition-all ${
              activeTab === tab.key
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conversations List */}
      <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-0.5">
        {filteredConversations.length === 0 ? (
          <div className="text-center p-8 text-xs text-muted-foreground">
            {searchQuery ? "No conversations match your search" : "No chats yet"}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <SingleConversation
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
              online={
                conversation.otherUser?.id
                  ? isUserOnline(conversation.otherUser.id)
                  : false
              }
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationList;

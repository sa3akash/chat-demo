"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { getMessages, MessageItem } from "@/actions/message";
import {
  ChatAckPayload,
  ReceiptReadPayload,
  SocketMessage,
  TypingUpdatePayload,
  ReactionUpdatePayload,
  MessageDeletePayload,
  MessageAttachment,
} from "@/types/socket.client";

export interface ChatMessageState {
  id: string;
  tempId?: string;
  conversationId: string;
  content: string;
  type: string; // "text" | "image" | "video" | "audio" | "file"
  senderId: string;
  sender?: {
    id: string;
    username: string;
    email?: string;
  } | null;
  replyToId?: string | null;
  replyToMessage?: ChatMessageState | null;
  attachments?: MessageAttachment[];
  reactions?: Record<string, string[]>;
  deletedForEveryone?: boolean;
  createdAt: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
}

export function useChat(conversationId: string) {
  const { user } = useAuth();
  const {
    isConnected,
    joinConversation,
    leaveConversation,
    sendChatMessage,
    sendTyping,
    markAsRead,
    sendReaction: socketSendReaction,
    deleteMessage: socketDeleteMessage,
    subscribe,
  } = useSocket();

  const [messages, setMessages] = useState<ChatMessageState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessageState | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map()); // userId -> username
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const typingUserTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 1. Fetch initial message history
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    setIsLoading(true);
    try {
      const res = await getMessages(conversationId);
      if (res.success && res.data?.messages) {
        // Backend returns in descending order (newest first), reverse for chronological display
        const history: ChatMessageState[] = res.data.messages
          .slice()
          .reverse()
          .map((m: MessageItem) => ({
            id: m.id,
            conversationId: m.conversationId,
            content: m.content,
            type: m.type,
            senderId: m.senderId,
            sender: m.sender,
            attachments: m.attachments,
            createdAt: m.createdAt,
            status: "sent",
          }));
        setMessages(history);

        // Mark latest as read
        if (history.length > 0) {
          const lastMsg = history[history.length - 1];
          markAsRead(conversationId, lastMsg.id);
        }
      }
    } catch (err) {
      console.error("Failed to load conversation messages", err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, markAsRead]);

  // 2. Room subscription lifecycle
  useEffect(() => {
    if (!conversationId) return;

    loadMessages();
    joinConversation(conversationId);

    return () => {
      leaveConversation(conversationId);
      typingUserTimeoutsRef.current.forEach((t) => clearTimeout(t));
      typingUserTimeoutsRef.current.clear();
      setTypingUsers(new Map());
      setReplyToMessage(null);
    };
  }, [conversationId, joinConversation, leaveConversation, loadMessages]);

  // 3. Socket event listeners for this conversation
  useEffect(() => {
    if (!conversationId) return;

    // A. Incoming message
    const unsubMessage = subscribe("chat:new", (data: SocketMessage) => {
      if (data.conversationId !== conversationId) return;

      setMessages((prev) => {
        // Resolve reply message reference if any
        let resolvedReply: ChatMessageState | null = null;
        if (data.replyToId) {
          resolvedReply = prev.find((m) => m.id === data.replyToId) || null;
        }

        // Match optimistic pending message by tempId
        if (data.tempId) {
          const optimisticIndex = prev.findIndex((m) => m.tempId === data.tempId);
          if (optimisticIndex !== -1) {
            const updated = [...prev];
            updated[optimisticIndex] = {
              ...updated[optimisticIndex],
              id: data.id,
              status: "sent",
              createdAt: data.createdAt,
              replyToId: data.replyToId,
              replyToMessage: resolvedReply || updated[optimisticIndex].replyToMessage,
              attachments: data.attachments || updated[optimisticIndex].attachments,
            };
            return updated;
          }
        }

        // Avoid duplicate
        if (prev.some((m) => m.id === data.id)) {
          return prev;
        }

        return [
          ...prev,
          {
            id: data.id,
            tempId: data.tempId,
            conversationId: data.conversationId,
            content: data.content,
            type: data.type,
            senderId: data.senderId,
            sender: data.sender,
            replyToId: data.replyToId,
            replyToMessage: resolvedReply,
            attachments: data.attachments,
            reactions: data.reactions || {},
            deletedForEveryone: data.deletedForEveryone || false,
            createdAt: data.createdAt,
            status: "delivered",
          },
        ];
      });

      // If received from someone else, mark as read
      if (data.senderId !== user?.id) {
        markAsRead(conversationId, data.id);
      }
    });

    // B. Sender acknowledgment from server
    const unsubAck = subscribe("chat:ack", (data: ChatAckPayload) => {
      if (data.conversationId !== conversationId) return;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.tempId === data.tempId || m.id === data.tempId) {
            return {
              ...m,
              id: data.messageId,
              status: "sent",
              createdAt: data.createdAt,
            };
          }
          return m;
        })
      );
    });

    // C. Typing indicators
    const unsubTyping = subscribe("typing:update", (data: TypingUpdatePayload) => {
      if (data.conversationId !== conversationId || data.userId === user?.id) return;

      const { userId, username, isTyping } = data;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (isTyping) {
          next.set(userId, username);
        } else {
          next.delete(userId);
        }
        return next;
      });

      if (typingUserTimeoutsRef.current.has(userId)) {
        clearTimeout(typingUserTimeoutsRef.current.get(userId));
        typingUserTimeoutsRef.current.delete(userId);
      }

      if (isTyping) {
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
          typingUserTimeoutsRef.current.delete(userId);
        }, 3500);
        typingUserTimeoutsRef.current.set(userId, timeout);
      }
    });

    // D. Read receipts
    const unsubRead = subscribe("receipt:read", (data: ReceiptReadPayload) => {
      if (data.conversationId !== conversationId) return;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId === user?.id && m.status !== "read") {
            return { ...m, status: "read" };
          }
          return m;
        })
      );
    });

    // E. Reaction update
    const unsubReaction = subscribe("reaction:update", (data: ReactionUpdatePayload) => {
      if (data.conversationId !== conversationId) return;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.messageId) {
            return { ...m, reactions: data.reactions };
          }
          return m;
        })
      );
    });

    // F. Message delete
    const unsubDelete = subscribe("message:delete", (data: MessageDeletePayload) => {
      if (data.conversationId !== conversationId) return;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.messageId) {
            return {
              ...m,
              deletedForEveryone: true,
              content: "This message was deleted",
            };
          }
          return m;
        })
      );
    });

    return () => {
      unsubMessage();
      unsubAck();
      unsubTyping();
      unsubRead();
      unsubReaction();
      unsubDelete();
    };
  }, [conversationId, subscribe, user?.id, markAsRead]);

  // 4. Send message optimistically
  const sendMessage = useCallback(
    ({
      content,
      type = "text",
      attachments,
    }: {
      content: string;
      type?: string;
      attachments?: MessageAttachment[];
    }) => {
      if ((!content.trim() && (!attachments || attachments.length === 0)) || !conversationId) return;

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const currentReply = replyToMessage;

      const optimisticMessage: ChatMessageState = {
        id: tempId,
        tempId,
        conversationId,
        content: content.trim(),
        type,
        senderId: user?.id || "",
        sender: {
          id: user?.id || "",
          username: user?.username || "Me",
        },
        replyToId: currentReply?.id || null,
        replyToMessage: currentReply,
        attachments,
        reactions: {},
        createdAt: new Date().toISOString(),
        status: "pending",
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setReplyToMessage(null); // Reset quoted message banner

      // Trigger socket send
      sendChatMessage({
        conversationId,
        content: content.trim(),
        type,
        tempId,
        replyToId: currentReply?.id || undefined,
        attachments,
      });

      // Clear typing state immediately
      if (isTypingRef.current) {
        isTypingRef.current = false;
        sendTyping(conversationId, false);
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    },
    [conversationId, replyToMessage, sendChatMessage, sendTyping, user]
  );

  // 5. Debounced typing notifier
  const onTyping = useCallback(() => {
    if (!conversationId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(conversationId, true);
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(conversationId, false);
    }, 2000);
  }, [conversationId, sendTyping]);

  // 6. Reactions and Deletes
  const handleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!conversationId) return;
      socketSendReaction(conversationId, messageId, emoji);
    },
    [conversationId, socketSendReaction]
  );

  const handleDelete = useCallback(
    (messageId: string) => {
      if (!conversationId) return;
      socketDeleteMessage(conversationId, messageId);
    },
    [conversationId, socketDeleteMessage]
  );

  return {
    messages,
    isLoading,
    isConnected,
    typingUsers: Array.from(typingUsers.values()),
    replyToMessage,
    setReplyToMessage,
    clearReplyTo: () => setReplyToMessage(null),
    sendMessage,
    onTyping,
    handleReaction,
    handleDelete,
    loadMessages,
  };
}

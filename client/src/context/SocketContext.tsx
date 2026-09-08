/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@/types/socket.client";

type EventHandler<T = any> = (data: T) => void;

interface SocketContextType {
  isConnected: boolean;
  isOnline: boolean; // Alias for isConnected
  onlineUserIds: Set<string>;
  isUserOnline: (userId: string) => boolean;
  checkPresence: (userIds: string[]) => Promise<void>;
  emit: <K extends keyof ClientToServerEvents>(
    type: K,
    payload: ClientToServerEvents[K],
  ) => void;
  sendMessage: (type: string, payload: any) => void; // Backward compatibility
  subscribe: <K extends keyof ServerToClientEvents>(
    type: K | string,
    handler: EventHandler<any>,
  ) => () => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendChatMessage: (params: {
    conversationId: string;
    content: string;
    type?: string;
    tempId?: string;
    replyToId?: string;
    attachments?: { url: string; name: string; mimeType: string }[];
  }) => void;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  markAsRead: (conversationId: string, messageId?: string) => void;
  sendReaction: (
    conversationId: string,
    messageId: string,
    emoji: string,
  ) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);
const WS_ENDPOINT = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4400/ws";

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const activeRoomsRef = useRef<Set<string>>(new Set());
  const outgoingQueueRef = useRef<string[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isManuallyClosedRef = useRef(false);

  const { user } = useAuth();
  const token = user?.accessToken;

  // 1. Subscribe to event types
  const subscribe = useCallback((type: string, handler: EventHandler) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(handler);

    return () => {
      listenersRef.current.get(type)?.delete(handler);
    };
  }, []);

  // 2. Dispatch incoming frames to subscribers
  const dispatchEvent = useCallback((type: string, payload: any) => {
    const handlers = listenersRef.current.get(type);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(payload);
        } catch (err) {
          console.error(`Error in socket listener for "${type}":`, err);
        }
      });
    }
  }, []);

  // 3. Emit frame to server or buffer if connecting
  const emit = useCallback((type: string, payload: any) => {
    const frame = JSON.stringify({ type, payload });
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(frame);
    } else {
      // Buffer critical events when temporarily disconnected
      if (type !== "heartbeat" && type !== "typing:update") {
        outgoingQueueRef.current.push(frame);
      }
    }
  }, []);

  // Backward-compatible alias
  const sendMessage = useCallback(
    (type: string, payload: any) => {
      emit(type as any, payload);
    },
    [emit],
  );

  // 4. Room Management (Topic Subscription)
  const joinConversation = useCallback(
    (conversationId: string) => {
      if (!conversationId) return;
      activeRoomsRef.current.add(conversationId);
      emit("room:join", { conversationId });
    },
    [emit],
  );

  const leaveConversation = useCallback(
    (conversationId: string) => {
      if (!conversationId) return;
      activeRoomsRef.current.delete(conversationId);
      emit("room:leave", { conversationId });
    },
    [emit],
  );

  // 5. Chat Actions
  const sendChatMessage = useCallback(
    ({
      conversationId,
      content,
      type = "text",
      tempId,
      replyToId,
      attachments,
    }: {
      conversationId: string;
      content: string;
      type?: string;
      tempId?: string;
      replyToId?: string;
      attachments?: { url: string; name: string; mimeType: string }[];
    }) => {
      emit("chat:send", {
        conversationId,
        content,
        type,
        tempId:
          tempId ||
          `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        replyToId,
        attachments: attachments || [],
      });
    },
    [emit],
  );

  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      emit("typing:update", { conversationId, isTyping });
    },
    [emit],
  );

  const markAsRead = useCallback(
    (conversationId: string, messageId?: string) => {
      emit("receipt:read", { conversationId, messageId });
    },
    [emit],
  );

  const sendReaction = useCallback(
    (conversationId: string, messageId: string, emoji: string) => {
      emit("reaction:update", { conversationId, messageId, emoji });
    },
    [emit],
  );

  const deleteMessage = useCallback(
    (conversationId: string, messageId: string) => {
      emit("message:delete", { conversationId, messageId });
    },
    [emit],
  );

  // 6. Connect & Lifecycle Management
  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        isManuallyClosedRef.current = true;
        socketRef.current.close();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    isManuallyClosedRef.current = false;

    function connect() {
      if (isManuallyClosedRef.current) return;

      try {
        const ws = new WebSocket(
          `${WS_ENDPOINT}?token=${encodeURIComponent(token!)}`,
        );
        socketRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          retryCountRef.current = 0;

          // Rejoin active conversation rooms after reconnect
          activeRoomsRef.current.forEach((conversationId) => {
            ws.send(
              JSON.stringify({
                type: "room:join",
                payload: { conversationId },
              }),
            );
          });

          // Request initial presence of all online users
          ws.send(JSON.stringify({ type: "presence:get", payload: {} }));

          // Flush queued outbound messages
          while (outgoingQueueRef.current.length > 0) {
            const frame = outgoingQueueRef.current.shift();
            if (frame) ws.send(frame);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          socketRef.current = null;

          if (!isManuallyClosedRef.current) {
            // Exponential backoff with jitter (1s - 10s)
            const timeout = Math.min(
              1000 * Math.pow(1.5, retryCountRef.current) + Math.random() * 500,
              10000,
            );
            retryCountRef.current += 1;
            reconnectTimeoutRef.current = setTimeout(connect, timeout);
          }
        };

        ws.onerror = () => {
          // onError will be followed by onclose where reconnection is handled
          setIsConnected(false);
        };

        ws.onmessage = (event) => {
          try {
            const { type, payload } = JSON.parse(event.data);

            // Handle presence initial list
            if (
              type === "presence:initial" &&
              Array.isArray(payload?.onlineUserIds)
            ) {
              setOnlineUserIds(new Set(payload.onlineUserIds));
            }

            // Handle presence update globally
            if (type === "presence:update" && payload?.userId) {
              setOnlineUserIds((prev) => {
                const next = new Set(prev);
                if (payload.status === "online") {
                  next.add(payload.userId);
                } else {
                  next.delete(payload.userId);
                }
                return next;
              });
            }

            dispatchEvent(type, payload);
          } catch (err) {
            console.error("Malformed socket frame", err);
          }
        };
      } catch (err) {
        console.error("WebSocket connection initiation failed:", err);
      }
    }

    connect();

    // Heartbeat every 20 seconds to keep 45s Redis lease active
    const heartbeatInterval = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({ type: "heartbeat", payload: {} }),
        );
      }
    }, 20000);

    return () => {
      isManuallyClosedRef.current = true;
      clearInterval(heartbeatInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [token, dispatchEvent]);

  // 7. Presence Check Helpers
  const checkPresence = useCallback(async (userIds: string[]) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "presence:get",
          payload: {
            userIds,
          },
        }),
      );
    }
  }, []);

  const isUserOnline = useCallback(
    (userId: string) => {
      return onlineUserIds.has(userId);
    },
    [onlineUserIds],
  );

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        isOnline: isConnected,
        onlineUserIds,
        isUserOnline,
        checkPresence,
        emit,
        sendMessage,
        subscribe,
        joinConversation,
        leaveConversation,
        sendChatMessage,
        sendTyping,
        markAsRead,
        sendReaction,
        deleteMessage,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

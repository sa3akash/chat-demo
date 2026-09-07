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

type EventHandler = (data: any) => void;

interface SocketContextType {
  isOnline: boolean;
  onlineUserIds: Set<string>;
  checkPresence: (userIds: string[]) => Promise<void>;
  sendMessage: (type: string, payload: any) => void;
  subscribe: (type: string, handler: EventHandler) => () => void;
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
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  const { user } = useAuth();
  const token = user?.accessToken;

  // 1. Maintain Connection & Heartbeat
  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_ENDPOINT}?token=${token}`);
    socketRef.current = ws;

    ws.onopen = () => setIsOnline(true);
    ws.onclose = () => setIsOnline(false);
    ws.onerror = () => setIsOnline(false);

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        const handlers = listenersRef.current.get(type);
        if (handlers) {
          handlers.forEach((fn) => fn(payload));
        }
      } catch (err) {
        console.error("Malformed socket frame", err);
      }
    };

    // Keep presence alive every 25 seconds (before 45s Redis lease expires)
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "heartbeat", payload: {} }));
      }
    }, 25000);

    return () => {
      clearInterval(interval);
      ws.close();
      socketRef.current = null;
    };
  }, [token]);

  // 2. Safe message delivery
  const sendMessage = useCallback((type: string, payload: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // 3. Subscription manager for client components
  const subscribe = useCallback((type: string, handler: EventHandler) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(handler);

    return () => {
      listenersRef.current.get(type)?.delete(handler);
    };
  }, []);

  // 4. Batch check active users on screen
  const checkPresence = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;
    try {
      const res = await fetch("/api/presence/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      const data = await res.json();

      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        // Add all returned active user IDs
        data.online.forEach((id: string) => next.add(id));
        return next;
      });
    } catch (err) {
      console.error("Failed to query presence batch", err);
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        isOnline,
        onlineUserIds,
        checkPresence,
        sendMessage,
        subscribe,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
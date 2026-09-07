"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useChatStore } from "@/lib/store";
import type { ClientMessage, ServerEvent } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";

type SocketContextValue = {
  send: (payload: ClientMessage) => void;
};

const SocketContext = createContext<SocketContextValue | null>(null);

/**
 * Owns the single WebSocket connection for the whole app: auth against the
 * token from AuthContext, exponential-backoff reconnect, and a heartbeat.
 * Every inbound frame is dispatched straight into the Zustand store so any
 * component can subscribe to just the slice it needs via the hooks below —
 * this provider only exposes `send`.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const dispatch = useChatStore((s) => s.handleServerEvent);
  const setConnectionStatus = useChatStore((s) => s.setConnectionStatus);

  useEffect(() => {
    if (!token) return;
    let closedByClient = false;
    let heartbeatInterval: ReturnType<typeof setInterval>;

    function connect() {
      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setConnectionStatus("connected");
        heartbeatInterval = setInterval(() => ws.send(JSON.stringify({ type: "presence:ping" })), 25000);
      };

      ws.onmessage = (event) => {
        try {
          dispatch(JSON.parse(event.data) as ServerEvent);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        clearInterval(heartbeatInterval);
        setConnectionStatus("disconnected");
        if (closedByClient) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
        retryRef.current += 1;
        setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      closedByClient = true;
      clearInterval(heartbeatInterval);
      wsRef.current?.close();
    };
  }, [token, dispatch, setConnectionStatus]);

  const value = useMemo<SocketContextValue>(
    () => ({
      send: (payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload));
        }
      },
    }),
    []
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
  return ctx;
}

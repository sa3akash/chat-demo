"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "./store";
import type { ServerEvent } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";

/**
 * Owns a single WebSocket connection for the whole app. Handles token auth,
 * exponential-backoff reconnect, and a periodic presence heartbeat, and
 * dispatches every inbound event straight into the Zustand store so any
 * component can subscribe to just the slice it needs.
 */
export function useChatSocket(token: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const dispatch = useChatStore((s) => s.handleServerEvent);

  useEffect(() => {
    if (!token) return;
    let closedByClient = false;
    let heartbeatInterval: ReturnType<typeof setInterval>;

    function connect() {
      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        useChatStore.getState().setConnectionStatus("connected");
        heartbeatInterval = setInterval(() => {
          ws.send(JSON.stringify({ type: "presence:ping" }));
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data: ServerEvent = JSON.parse(event.data);
          dispatch(data);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        clearInterval(heartbeatInterval);
        useChatStore.getState().setConnectionStatus("disconnected");
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
  }, [token, dispatch]);

  function send(payload: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }

  return { send };
}

import { useEffect, useEffectEvent } from "react";
import { useSocket } from "../context/SocketContext";
import type { SocketEventType, SocketPayloadMap } from "../types/socket.client";

export function useSocketEvent<K extends SocketEventType>(
  eventType: K,
  handler: (payload: SocketPayloadMap[K]) => void
) {
  const { socket } = useSocket();

  // useEffectEvent captures the latest handler without triggering re-subscriptions
  const onEvent = useEffectEvent((payload: SocketPayloadMap[K]) => {
    handler(payload);
  });

  useEffect(() => {
    if (!socket) return;

    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === eventType) {
          onEvent(message.payload);
        }
      } catch(err) {
        // Ignore unparseable or binary frames
        console.error("Error parsing message:", err);
      }
    };

    socket.addEventListener("message", onMessage);

    return () => {
      socket.removeEventListener("message", onMessage);
    };
  }, [socket, eventType]); // Clean, minimal dependencies
}
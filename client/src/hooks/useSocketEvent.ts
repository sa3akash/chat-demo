import { useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import type { ServerToClientEvents } from "../types/socket.client";

export function useSocketEvent<K extends keyof ServerToClientEvents>(
  eventType: K,
  handler: (payload: ServerToClientEvents[K]) => void
) {
  const { subscribe } = useSocket();

  useEffect(() => {
    return subscribe(eventType, handler);
  }, [subscribe, eventType, handler]);
}
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
} from "react";
import { useAuth } from "../AuthContext";

interface SocketContextType {
  socket: WebSocket | null;
  isOnline: boolean;
  sendMessage: (data: string | object) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

const SOCKET_URL = "ws://localhost:4400/ws";

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const token = user?.token;

  // Track socket instance inside a dedicated manager
  const socketStoreRef = useRef<{
    socket: WebSocket | null;
    isOnline: boolean;
    listeners: Set<() => void>;
  }>({
    socket: null,
    isOnline: false,
    listeners: new Set(),
  });

  const notify = () => {
    socketStoreRef.current.listeners.forEach((listener) => listener());
  };

  // Subscribe React to the external WebSocket store lifecycle
  const subscribe = useCallback((onStoreChange: () => void) => {
    const store = socketStoreRef.current;
    store.listeners.add(onStoreChange);

    if (token && !store.socket) {
      const ws = new WebSocket(`${SOCKET_URL}?token=${token}`);
      store.socket = ws;

      ws.onopen = () => {
        store.isOnline = true;
        notify();
      };

      ws.onclose = () => {
        store.isOnline = false;
        store.socket = null;
        notify();
      };

      ws.onerror = (err) => {
        console.error("WebSocket encountered an error:", err);
        store.isOnline = false;
        notify();
      };

      notify();
    }

    return () => {
      store.listeners.delete(onStoreChange);
      if (store.socket) {
        store.socket.close();
        store.socket = null;
        store.isOnline = false;
      }
    };
  }, [token]);

  // Synchronous, safe store snapshots
  const getSnapshotSocket = useCallback(() => socketStoreRef.current.socket, []);
  const getSnapshotOnline = useCallback(() => socketStoreRef.current.isOnline, []);

  const socket = useSyncExternalStore(subscribe, getSnapshotSocket);
  const isOnline = useSyncExternalStore(subscribe, getSnapshotOnline);

  const sendMessage = useCallback((data: string | object) => {
    const ws = socketStoreRef.current.socket;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      ws.send(payload);
    } else {
      console.warn("WebSocket is not connected. Message not sent.");
    }
  }, []);

  return (
    <SocketContext.Provider value={{ socket, sendMessage, isOnline }}>
      {children}
    </SocketContext.Provider>
  );
};
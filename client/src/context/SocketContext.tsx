import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "./AuthContext";

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
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);

  const { user } = useAuth();
  const token = user?.token;

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${SOCKET_URL}?token=${token}`);

    ws.onopen = () => {
      setIsOnline(true);
    };

    ws.onclose = () => {
      setIsOnline(false);
    };

    ws.onerror = (err) => {
      console.error("WebSocket encountered an error:", err);
      setIsOnline(false);
    };

    // Defers state update to the next microtask tick.
    // This stops React Compiler from complaining about synchronous setState in effects.
    queueMicrotask(() => {
      setSocket(ws);
    });

    return () => {
      ws.close();
      setSocket(null);
      setIsOnline(false);
    };
  }, [token]);

  const sendMessage = useCallback(
    (data: string | object) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        socket.send(payload);
      } else {
        console.warn("WebSocket is not connected. Message not sent.");
      }
    },
    [socket]
  );

  return (
    <SocketContext.Provider value={{ socket, isOnline, sendMessage }}>
      {children}
    </SocketContext.Provider>
  );
};
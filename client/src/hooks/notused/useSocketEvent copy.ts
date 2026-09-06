import { useSocket } from "@/context/SocketContext";
import { useEffect, useRef } from "react";

interface SocketMessage<T = unknown> {
  type: string;
  payload: T;
}

export function useSocketEvent<T = unknown>(
  eventType: string,
  handler: (payload: T) => void
) {
  const { socket } = useSocket();

  // 1. Keep a mutable ref of the handler
  const handlerRef = useRef(handler);

  // 2. Always update the ref to the freshest callback after every render
  useEffect(() => {
    handlerRef.current = handler;
  });

  // 3. Bind the listener only when socket or eventType changes
  useEffect(() => {
    if (!socket) return;

    const listener = (event: MessageEvent) => {
      try {
        const msg: SocketMessage<T> = JSON.parse(event.data);
        if (msg.type === eventType) {
          // Calls the latest version of handler without re-binding
          handlerRef.current(msg.payload);
        }
      } catch (err) {
        // If message is not JSON, ignore or handle accordingly
        console.error("Failed to parse socket payload:", err);
      }
    };

    socket.addEventListener("message", listener);

    return () => {
      socket.removeEventListener("message", listener);
    };
  }, [socket, eventType]); // Note: handler is NOT here!
}


// // Inside ChatBox.tsx
// useSocketEvent<{ sender: string; text: string }>("NEW_MESSAGE", (message) => {
//   console.log("Chat message received:", message.text);
// });

// // Inside Notifications.tsx
// useSocketEvent<{ count: number }>("NOTIFICATION_COUNT", ({ count }) => {
//   console.log("Unread count updated:", count);
// });

// // Inside UserPresence.tsx
// useSocketEvent<{ userId: string; status: string }>("STATUS_CHANGE", (status) => {
//   console.log("User updated:", status);
// });
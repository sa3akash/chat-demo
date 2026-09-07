"use client";

import { useCallback, useRef } from "react";
import { useSocket } from "@/lib/context/SocketContext";
import { useAuth } from "@/lib/context/AuthContext";
import { useChatStore } from "@/lib/store";

/** Debounced typing-indicator send/receive for one conversation. */
export function useTyping(conversationId: string | null) {
  const { user } = useAuth();
  const { send } = useSocket();
  const typingUserIds = useChatStore((s) =>
    conversationId ? Array.from(s.typingByConversation[conversationId] ?? []) : []
  );
  const conversations = useChatStore((s) => s.conversations);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conversation = conversations.find((c) => c.id === conversationId);
  const typingUsernames = typingUserIds
    .filter((id) => id !== user?.id)
    .map((id) => conversation?.members.find((m) => m.id === id)?.username)
    .filter((n): n is string => Boolean(n));

  // Debounced: a keystroke sends typing:start (if not already sent) and
  // resets a 1.5s timer that sends typing:stop if no further keystrokes
  // arrive — mirrors the pattern most chat apps use to avoid flooding the
  // socket with an event per keystroke.
  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversationId) return;
      if (isTyping) {
        send({ type: "typing:start", conversationId });
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => send({ type: "typing:stop", conversationId }), 1500);
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        send({ type: "typing:stop", conversationId });
      }
    },
    [conversationId, send]
  );

  return { typingUsernames, notifyTyping };
}

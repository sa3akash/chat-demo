"use client";

import { useCallback, useEffect } from "react";
import { useSocket } from "@/lib/context/SocketContext";
import { useAuth } from "@/lib/context/AuthContext";
import { useChatStore } from "@/lib/store";

/**
 * Tracks + reports read state for one conversation. Auto-marks the latest
 * message read whenever it changes while this conversation is open (mirrors
 * "seen" behavior in Messenger/WhatsApp — no explicit user action needed).
 */
export function useReadReceipts(conversationId: string | null) {
  const { user } = useAuth();
  const { send } = useSocket();
  const messages = useChatStore((s) => (conversationId ? s.messagesByConversation[conversationId] ?? [] : []));
  const receipts = useChatStore((s) => (conversationId ? s.readReceiptsByConversation[conversationId] ?? [] : []));

  const markRead = useCallback(
    (messageId: string) => {
      if (!conversationId) return;
      send({ type: "message:read", conversationId, messageId });
    },
    [conversationId, send]
  );

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest && !latest.pending) markRead(latest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, conversationId]);

  const readByOthers = receipts.filter((r) => r.userId !== user?.id);

  return { receipts: readByOthers, markRead };
}

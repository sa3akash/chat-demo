"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSocket } from "@/lib/context/SocketContext";
import { useAuth } from "@/lib/context/AuthContext";
import { useChatStore } from "@/lib/store";
import { nanoid } from "@/lib/nanoid";

/**
 * All message state + actions for one conversation: initial load, older-page
 * loading (infinite scroll), and optimistic send with WS ack reconciliation.
 * Pass null when nothing is selected — the hook just no-ops.
 */
export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const { send } = useSocket();
  const messages = useChatStore((s) => (conversationId ? s.messagesByConversation[conversationId] ?? [] : []));
  const setMessages = useChatStore((s) => s.setMessages);
  const prependMessages = useChatStore((s) => s.prependMessages);
  const addOptimisticMessage = useChatStore((s) => s.addOptimisticMessage);

  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadedConversation = useRef<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    loadedConversation.current = conversationId;
    setHasMore(true);
    api.getMessages(conversationId).then((res: any) => {
      if (loadedConversation.current !== conversationId) return; // stale response, user switched chats
      setMessages(conversationId, res.messages);
      setHasMore(Boolean(res.nextCursor));
    });
    send({ type: "conversation:join", conversationId });
  }, [conversationId, setMessages, send]);

  const loadMore = useCallback(async () => {
    if (!conversationId || loadingMore || !hasMore) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const res: any = await api.getMessages(conversationId, oldest.id);
      prependMessages(conversationId, res.messages);
      setHasMore(Boolean(res.nextCursor));
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore, hasMore, messages, prependMessages]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!conversationId || !user) return;
      const tempId = nanoid();
      addOptimisticMessage({
        id: tempId,
        tempId,
        conversationId,
        senderId: user.id,
        content,
        createdAt: new Date().toISOString(),
        sender: { id: user.id, username: user.username },
        pending: true,
      });
      send({ type: "message:send", conversationId, content, tempId });
    },
    [conversationId, user, send, addOptimisticMessage]
  );

  return { messages, sendMessage, loadMore, loadingMore, hasMore };
}

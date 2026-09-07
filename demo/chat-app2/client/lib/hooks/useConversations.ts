"use client";

import { useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import type { Conversation } from "@/types";

/** Fetches + exposes the conversation list, and how to start new ones. */
export function useConversations() {
  const conversations = useChatStore((s) => s.conversations);
  const setConversations = useChatStore((s) => s.setConversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  const refresh = useCallback(async () => {
    const list = (await api.getConversations()) as Conversation[];
    setConversations(list);
  }, [setConversations]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startDirect = useCallback(
    async (targetUserId: string) => {
      const conversation = (await api.startDirect(targetUserId)) as Conversation;
      await refresh();
      setActiveConversation(conversation.id);
      return conversation;
    },
    [refresh, setActiveConversation]
  );

  const createGroup = useCallback(
    async (name: string, memberIds: string[]) => {
      const conversation = (await api.createGroup(name, memberIds)) as Conversation;
      await refresh();
      return conversation;
    },
    [refresh]
  );

  return {
    conversations,
    activeConversationId,
    setActiveConversation,
    refresh,
    startDirect,
    createGroup,
  };
}

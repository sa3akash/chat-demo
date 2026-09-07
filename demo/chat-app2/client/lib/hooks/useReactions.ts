"use client";

import { useCallback } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { useSocket } from "@/lib/context/SocketContext";
import type { Message } from "@/types";

/** Add/remove/toggle an emoji reaction on a message (one reaction per user, like Messenger). */
export function useReactions(conversationId: string | null) {
  const { user } = useAuth();
  const { send } = useSocket();

  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!conversationId) return;
      send({ type: "reaction:add", conversationId, messageId, emoji });
    },
    [conversationId, send]
  );

  const removeReaction = useCallback(
    (messageId: string) => {
      if (!conversationId) return;
      send({ type: "reaction:remove", conversationId, messageId });
    },
    [conversationId, send]
  );

  const toggleReaction = useCallback(
    (message: Message, emoji: string) => {
      const mine = message.reactions?.find((r) => r.userId === user?.id);
      if (mine?.emoji === emoji) removeReaction(message.id);
      else addReaction(message.id, emoji);
    },
    [user, addReaction, removeReaction]
  );

  return { addReaction, removeReaction, toggleReaction };
}

"use client";

import { useCallback } from "react";
import { useChatStore } from "@/lib/store";

/**
 * Presence reads: backed by the store's onlineUserIds set, which is seeded
 * from the REST snapshot (see store.setConversations), corrected by the WS
 * presence:bulk event on connect, and kept live by presence:update after
 * that. Components never need to know about that three-stage handshake —
 * they just call isOnline(userId).
 */
export function usePresence() {
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const lastSeenByUser = useChatStore((s) => s.lastSeenByUser);

  const isOnline = useCallback((userId: string) => onlineUserIds.has(userId), [onlineUserIds]);
  const lastSeen = useCallback((userId: string) => lastSeenByUser[userId] ?? null, [lastSeenByUser]);

  return { onlineUserIds, isOnline, lastSeen };
}

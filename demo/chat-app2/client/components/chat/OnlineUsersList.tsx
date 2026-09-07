"use client";

import { useConversations } from "@/lib/hooks/useConversations";
import { usePresence } from "@/lib/hooks/usePresence";
import { PresenceIndicator } from "./PresenceIndicator";

/**
 * A quick "who's online right now" strip across all your contacts —
 * demonstrates that presence is correct on load, not just for people who
 * connect/disconnect while you're already watching.
 */
export function OnlineUsersList({ currentUserId }: { currentUserId: string }) {
  const { conversations } = useConversations();
  const { isOnline } = usePresence();

  const contacts = new Map<string, { id: string; username: string }>();
  conversations.forEach((c) =>
    c.members.forEach((m) => {
      if (m.id !== currentUserId) contacts.set(m.id, m);
    })
  );
  const online = [...contacts.values()].filter((u) => isOnline(u.id));

  if (online.length === 0) return null;

  return (
    <div className="border-b border-neutral-200 px-4 py-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Online — {online.length}
      </div>
      <div className="flex flex-wrap gap-2">
        {online.map((u) => (
          <div key={u.id} className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs">
            <PresenceIndicator online />
            {u.username}
          </div>
        ))}
      </div>
    </div>
  );
}

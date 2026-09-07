"use client";

import { useConversations } from "@/lib/hooks/useConversations";
import { usePresence } from "@/lib/hooks/usePresence";
import { PresenceIndicator } from "./PresenceIndicator";
import { OnlineUsersList } from "./OnlineUsersList";

export function Sidebar({ currentUserId }: { currentUserId: string }) {
  const { conversations, activeConversationId, setActiveConversation } = useConversations();
  const { isOnline } = usePresence();

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-neutral-200 bg-white overflow-hidden">
      <OnlineUsersList currentUserId={currentUserId} />

      <div className="px-4 py-3 text-sm font-semibold text-neutral-500">Conversations</div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((c) => {
          const other = c.type === "DIRECT" ? c.members.find((m) => m.id !== currentUserId) : null;
          const label = c.type === "GROUP" ? c.name ?? "Group" : other?.username ?? "Direct message";
          const online = other ? isOnline(other.id) : false;

          return (
            <button
              key={c.id}
              onClick={() => setActiveConversation(c.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 ${
                activeConversationId === c.id ? "bg-neutral-100" : ""
              }`}
            >
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-sm font-medium">
                  {label.slice(0, 1).toUpperCase()}
                </div>
                {c.type === "DIRECT" && (
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <PresenceIndicator online={online} />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{label}</div>
                <div className="truncate text-xs text-neutral-400">
                  {c.lastMessage?.content ?? "No messages yet"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { useChatStore } from "@/lib/store";
import { useConversations } from "@/lib/hooks/useConversations";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { GroupCreateModal } from "@/components/chat/GroupCreateModal";

export default function ChatPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { activeConversationId, refresh } = useConversations();
  const connectionStatus = useChatStore((s) => s.connectionStatus);
  const [showGroupModal, setShowGroupModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex h-full items-center justify-center text-neutral-400">Loading…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 text-xs">
        <span className="text-neutral-400">
          {user.username} · {connectionStatus}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGroupModal(true)} className="rounded-full bg-neutral-900 px-3 py-1 text-white">
            + New group
          </button>
          <button onClick={logout} className="rounded-full px-3 py-1 text-neutral-400 hover:text-neutral-800">
            Log out
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentUserId={user.id} />
        <ChatWindow currentUserId={user.id} activeConversationId={activeConversationId} />
      </div>

      {showGroupModal && (
        <GroupCreateModal onClose={() => setShowGroupModal(false)} onCreated={refresh} />
      )}
    </div>
  );
}

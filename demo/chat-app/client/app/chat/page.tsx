"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "@/lib/nanoid";
import { api } from "@/lib/api";
import { useChatSocket } from "@/lib/socket";
import { useChatStore } from "@/lib/store";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { GroupCreateModal } from "@/components/chat/GroupCreateModal";

export default function ChatPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);

  const setConversations = useChatStore((s) => s.setConversations);
  const setMessages = useChatStore((s) => s.setMessages);
  const addOptimisticMessage = useChatStore((s) => s.addOptimisticMessage);
  const connectionStatus = useChatStore((s) => s.connectionStatus);
  const activeConversationId = useChatStore((s) => s.activeConversationId);

  const { send } = useChatSocket(token);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (!stored) {
      router.replace("/login");
      return;
    }
    setToken(stored);
    api.me().then((u: any) => setCurrentUser(u));
  }, [router]);

  async function refreshConversations() {
    const list = (await api.getConversations()) as any[];
    setConversations(list);
  }

  useEffect(() => {
    if (token) refreshConversations();
  }, [token]);

  useEffect(() => {
    if (!activeConversationId) return;
    api.getMessages(activeConversationId).then((res: any) => {
      setMessages(activeConversationId, res.messages);
    });
    send({ type: "conversation:join", conversationId: activeConversationId });
  }, [activeConversationId]);

  function handleSend(conversationId: string, content: string) {
    if (!currentUser) return;
    const tempId = nanoid();
    addOptimisticMessage({
      id: tempId,
      tempId,
      conversationId,
      senderId: currentUser.id,
      content,
      createdAt: new Date().toISOString(),
      sender: { id: currentUser.id, username: currentUser.username },
      pending: true,
    });
    send({ type: "message:send", conversationId, content, tempId });
  }

  function handleTyping(conversationId: string, isTyping: boolean) {
    send({ type: isTyping ? "typing:start" : "typing:stop", conversationId });
  }

  if (!currentUser) return <div className="flex h-full items-center justify-center text-neutral-400">Loading…</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 text-xs">
        <span className="text-neutral-400">
          {currentUser.username} · {connectionStatus}
        </span>
        <button onClick={() => setShowGroupModal(true)} className="rounded-full bg-neutral-900 px-3 py-1 text-white">
          + New group
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentUserId={currentUser.id} />
        <ChatWindow currentUserId={currentUser.id} onSend={handleSend} onTyping={handleTyping} />
      </div>
      {showGroupModal && (
        <GroupCreateModal onClose={() => setShowGroupModal(false)} onCreated={refreshConversations} />
      )}
    </div>
  );
}

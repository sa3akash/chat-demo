"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/store";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";

export function ChatWindow({
  currentUserId,
  onSend,
  onTyping,
}: {
  currentUserId: string;
  onSend: (conversationId: string, content: string) => void;
  onTyping: (conversationId: string, isTyping: boolean) => void;
}) {
  const activeId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const messages = useChatStore((s) => (activeId ? s.messagesByConversation[activeId] ?? [] : []));
  const typingUserIds = useChatStore((s) =>
    activeId ? Array.from(s.typingByConversation[activeId] ?? []) : []
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!activeId) {
    return <div className="flex flex-1 items-center justify-center text-neutral-400">Select a conversation</div>;
  }

  const conversation = conversations.find((c) => c.id === activeId);
  const typingUsernames = typingUserIds
    .filter((id) => id !== currentUserId)
    .map((id) => conversation?.members.find((m) => m.id === id)?.username)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-neutral-200 bg-white px-4 py-3 text-sm font-medium">
        {conversation?.type === "GROUP"
          ? conversation.name
          : conversation?.members.find((m) => m.id !== currentUserId)?.username}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {messages.map((m) => (
          <MessageBubble key={m.tempId ?? m.id} message={m} isOwn={m.senderId === currentUserId} />
        ))}
        <div ref={bottomRef} />
      </div>

      <TypingIndicator usernames={typingUsernames} />
      <MessageInput
        onSend={(content) => onSend(activeId, content)}
        onTyping={(isTyping) => onTyping(activeId, isTyping)}
      />
    </div>
  );
}

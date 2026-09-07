"use client";

import { useEffect, useRef } from "react";
import { useConversations } from "@/lib/hooks/useConversations";
import { useMessages } from "@/lib/hooks/useMessages";
import { useTyping } from "@/lib/hooks/useTyping";
import { useReadReceipts } from "@/lib/hooks/useReadReceipts";
import { usePresence } from "@/lib/hooks/usePresence";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { PresenceIndicator } from "./PresenceIndicator";

export function ChatWindow({
  currentUserId,
  activeConversationId,
}: {
  currentUserId: string;
  activeConversationId: string | null;
}) {
  const { conversations } = useConversations();
  const { messages, sendMessage, loadMore, hasMore, loadingMore } = useMessages(activeConversationId);
  const { typingUsernames, notifyTyping } = useTyping(activeConversationId);
  const { receipts, markRead } = useReadReceipts(activeConversationId);
  const { isOnline } = usePresence();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Infinite scroll: fetch older messages when scrolled near the top.
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (e.currentTarget.scrollTop < 80 && hasMore && !loadingMore) loadMore();
  }

  if (!activeConversationId) {
    return <div className="flex flex-1 items-center justify-center text-neutral-400">Select a conversation</div>;
  }

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const other = conversation?.type === "DIRECT" ? conversation.members.find((m) => m.id !== currentUserId) : null;

  function readByUsernamesFor(messageIndex: number) {
    // A read receipt marks "read up through this message" — so anyone whose
    // lastReadMessageId is at/after this message counts as having seen it.
    // Simple version: only annotate the most recent message from me.
    if (messageIndex !== messages.length - 1) return [];
    return receipts
      .map((r) => conversation?.members.find((m) => m.id === r.userId)?.username)
      .filter((n): n is string => Boolean(n));
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-white px-4 py-3 text-sm font-medium">
        {conversation?.type === "GROUP" ? (
          conversation.name
        ) : (
          <>
            {other?.username}
            {other && <PresenceIndicator online={isOnline(other.id)} />}
          </>
        )}
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-2">
        {loadingMore && <div className="py-2 text-center text-xs text-neutral-400">Loading earlier messages…</div>}
        {messages.map((m, i) => (
          <MessageBubble
            key={m.tempId ?? m.id}
            message={m}
            isOwn={m.senderId === currentUserId}
            conversationId={activeConversationId}
            readByUsernames={m.senderId === currentUserId ? readByUsernamesFor(i) : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <TypingIndicator usernames={typingUsernames} />
      <MessageInput onSend={sendMessage} onTyping={notifyTyping} />
    </div>
  );
}

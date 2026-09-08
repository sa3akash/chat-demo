"use client";

import React, { useEffect, useRef } from "react";
import { SingleMessage } from "./SingleMessage";
import { useAuth } from "@/context/AuthContext";
import { ChatMessageState } from "@/hooks/useChat";
import { Loader2 } from "lucide-react";
import { isToday, isYesterday, format } from "date-fns";

interface ChatMessageProps {
  messages?: ChatMessageState[];
  isLoading?: boolean;
  typingUsers?: string[];
  onReply?: (message: ChatMessageState) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
}

function formatDateDivider(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMMM d, yyyy");
  } catch {
    return dateStr;
  }
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  messages = [],
  isLoading = false,
  typingUsers = [],
  onReply,
  onReaction,
  onDelete,
}) => {
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Automatically scroll to bottom when messages or typing state updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs font-medium">Loading chat history...</p>
        </div>
      </div>
    );
  }

  // Group messages by calendar day for dividers
  let lastDay = "";

  return (
    <div
      ref={scrollContainerRef}
      className="flex h-full flex-col overflow-y-auto p-4 gap-1 select-text"
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3 text-2xl shadow-inner">
            💬
          </div>
          <p className="text-sm font-semibold text-foreground">No messages here yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Send a message or voice note to begin the conversation!
          </p>
        </div>
      ) : (
        <div className="flex flex-col mt-auto">
          {messages.map((msg) => {
            const isMine = msg.senderId === user?.id;

            // Compute date divider
            let showDivider = false;
            let dividerText = "";
            if (msg.createdAt) {
              const currentDay = format(new Date(msg.createdAt), "yyyy-MM-dd");
              if (currentDay !== lastDay) {
                lastDay = currentDay;
                showDivider = true;
                dividerText = formatDateDivider(msg.createdAt);
              }
            }

            return (
              <React.Fragment key={msg.id || msg.tempId}>
                {showDivider && (
                  <div className="flex items-center my-4 justify-center">
                    <div className="border-t border-border/60 flex-1" />
                    <span className="px-3 py-1 bg-muted/60 border border-border/40 rounded-full text-[11px] font-medium text-muted-foreground shadow-xs">
                      {dividerText}
                    </span>
                    <div className="border-t border-border/60 flex-1" />
                  </div>
                )}

                <SingleMessage
                  message={msg}
                  user={isMine ? "mine" : "other"}
                  currentUserId={user?.id}
                  onReply={onReply}
                  onReaction={onReaction}
                  onDelete={onDelete}
                />
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Real-time Typing Bubble */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-2">
          <div className="flex gap-1.5 items-center bg-muted/80 backdrop-blur px-3.5 py-2 rounded-full border border-border/50 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></span>
            <span className="ml-1.5 font-medium text-[11px] text-foreground">
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
            </span>
          </div>
        </div>
      )}

      {/* Anchor for auto-scroll */}
      <div ref={bottomRef} className="h-2 shrink-0" />
    </div>
  );
};

export default ChatMessage;
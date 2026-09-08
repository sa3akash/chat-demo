"use client";

import React from "react";
import { IConversation } from "@/types/conversation";
import { fromNow } from "@/lib/timeAgo";
import Link from "next/link";

interface SingleConversationProps {
  conversation: IConversation;
  isActive: boolean;
  online?: boolean;
}

const SingleConversation: React.FC<SingleConversationProps> = ({
  conversation,
  isActive,
  online = false,
}) => {
  const username = conversation.otherUser?.username || conversation.title || "Chat";
  const avatarInitials = username.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/chat?id=${conversation.id}`}
      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
        isActive
          ? "bg-primary/15 text-foreground ring-1 ring-primary/30 font-medium"
          : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-border/60 flex items-center justify-center text-primary text-xs font-semibold">
            {avatarInitials}
          </div>
          {online && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="text-sm font-semibold truncate text-foreground">
              {username}
            </p>
          </div>
          <p className="text-xs text-muted-foreground truncate max-w-[140px]">
            {conversation.latestMessage?.content || "No messages yet"}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
        <span className="text-[10px] text-muted-foreground">
          {conversation.lastMessageAt ? fromNow(conversation.lastMessageAt) : ""}
        </span>
        {conversation.unreadCount > 0 && !isActive && (
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground min-w-4 text-center">
            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
};

export default SingleConversation;

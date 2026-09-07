"use client";

import { useState } from "react";
import type { Message } from "@/types";
import { useReactions } from "@/lib/hooks/useReactions";
import { useAuth } from "@/lib/context/AuthContext";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({
  message,
  isOwn,
  conversationId,
  readByUsernames,
}: {
  message: Message;
  isOwn: boolean;
  conversationId: string;
  readByUsernames?: string[];
}) {
  const { user } = useAuth();
  const { toggleReaction } = useReactions(conversationId);
  const [showPicker, setShowPicker] = useState(false);

  const reactionCounts = (message.reactions ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});
  const myReaction = message.reactions?.find((r) => r.userId === user?.id)?.emoji;

  return (
    <div className={`group relative flex ${isOwn ? "justify-end" : "justify-start"} px-4 py-1`}>
      <div className="relative max-w-[70%]">
        <div
          onDoubleClick={() => toggleReaction(message, "❤️")}
          className={`rounded-2xl px-4 py-2 text-sm ${
            isOwn ? "bg-neutral-900 text-white" : "bg-white text-neutral-900 border border-neutral-200"
          } ${message.pending ? "opacity-60" : ""}`}
        >
          {!isOwn && <div className="mb-0.5 text-xs font-medium text-neutral-400">{message.sender.username}</div>}
          <div>{message.content}</div>
        </div>

        {/* Reaction picker trigger — shows on hover */}
        <button
          onClick={() => setShowPicker((v) => !v)}
          className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white p-1 text-xs opacity-0 shadow group-hover:opacity-100 ${
            isOwn ? "-left-8" : "-right-8"
          }`}
        >
          🙂
        </button>

        {showPicker && (
          <div
            className={`absolute z-10 flex gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 shadow-lg ${
              isOwn ? "right-0 -top-9" : "left-0 -top-9"
            }`}
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  toggleReaction(message, emoji);
                  setShowPicker(false);
                }}
                className="rounded-full p-1 text-sm hover:bg-neutral-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {Object.keys(reactionCounts).length > 0 && (
          <div className={`mt-1 flex gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <span
                key={emoji}
                className={`rounded-full border px-1.5 py-0.5 text-[11px] ${
                  myReaction === emoji ? "border-neutral-900 bg-neutral-100" : "border-neutral-200 bg-white"
                }`}
              >
                {emoji} {count > 1 && count}
              </span>
            ))}
          </div>
        )}

        {isOwn && readByUsernames && readByUsernames.length > 0 && (
          <div className="mt-0.5 text-right text-[10px] text-neutral-400">
            Seen by {readByUsernames.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

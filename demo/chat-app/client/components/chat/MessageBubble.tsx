"use client";

import type { Message } from "@/types";

export function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} px-4 py-1`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
          isOwn ? "bg-neutral-900 text-white" : "bg-white text-neutral-900 border border-neutral-200"
        } ${message.pending ? "opacity-60" : ""}`}
      >
        {!isOwn && <div className="mb-0.5 text-xs font-medium text-neutral-400">{message.sender.username}</div>}
        <div>{message.content}</div>
      </div>
    </div>
  );
}

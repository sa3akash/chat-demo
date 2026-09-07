"use client";

import { useRef, useState } from "react";

export function MessageInput({
  onSend,
  onTyping,
}: {
  onSend: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(v: string) {
    setValue(v);
    onTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    onTyping(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 border-t border-neutral-200 bg-white p-3">
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Type a message…"
        className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm outline-none focus:border-neutral-500"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}

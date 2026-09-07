"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useConversations } from "@/lib/hooks/useConversations";
import type { User } from "@/types";

export function GroupCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { createGroup } = useConversations();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) return setResults([]);
    setResults((await api.searchUsers(q)) as User[]);
  }

  function toggle(user: User) {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]
    );
  }

  async function handleCreate() {
    if (!name.trim() || selected.length === 0) return;
    await createGroup(name.trim(), selected.map((u) => u.id));
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">New group</h2>
        <input
          placeholder="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <input
          placeholder="Search people…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((u) => (
              <span key={u.id} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs">
                {u.username}
              </span>
            ))}
          </div>
        )}

        <div className="max-h-40 overflow-y-auto">
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50 ${
                selected.some((s) => s.id === u.id) ? "bg-neutral-100" : ""
              }`}
            >
              {u.username}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-neutral-500">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

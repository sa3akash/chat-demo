"use client";

export function TypingIndicator({ usernames }: { usernames: string[] }) {
  if (usernames.length === 0) return null;
  const label =
    usernames.length === 1
      ? `${usernames[0]} is typing…`
      : `${usernames.slice(0, 2).join(", ")}${usernames.length > 2 ? " and others" : ""} are typing…`;
  return <div className="px-4 py-1 text-xs italic text-neutral-400">{label}</div>;
}

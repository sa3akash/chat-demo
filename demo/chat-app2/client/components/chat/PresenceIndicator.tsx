"use client";

export function PresenceIndicator({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white ${
        online ? "bg-green-500" : "bg-neutral-300"
      }`}
      title={online ? "Online" : "Offline"}
    />
  );
}

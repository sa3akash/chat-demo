"use client";

import React from "react";

interface ControlButtonProps {
  /** The icon to display */
  icon: React.ReactNode;
  /** Tooltip / aria-label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** If false, renders in "off" / red state */
  active?: boolean;
  /** Pulsing ring (e.g. when speaking and mic is on) */
  pulse?: boolean;
  /** Accent blue/purple state (e.g. screen sharing active) */
  accent?: boolean;
  /** Smaller size for audio call layout */
  small?: boolean;
  /** Danger red (e.g. end call button) */
  danger?: boolean;
  /** Optional small badge */
  badge?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Pill-style circular control button for call overlays.
 * Supports active/inactive, accent, danger, pulse, and badge variants.
 */
export const ControlButton: React.FC<ControlButtonProps> = ({
  icon,
  label,
  onClick,
  active = true,
  pulse = false,
  accent = false,
  small = false,
  danger = false,
  badge,
  disabled = false,
}) => {
  const size = small ? "w-12 h-12" : "w-14 h-14";

  const bg = danger
    ? "bg-red-500 hover:bg-red-600 border-red-400/30 shadow-red-500/30"
    : accent
      ? "bg-indigo-500 hover:bg-indigo-400 border-indigo-300/30 shadow-indigo-500/20"
      : active
        ? "bg-white/15 hover:bg-white/25 border-white/15"
        : "bg-red-500/85 hover:bg-red-500 border-red-400/30";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 group disabled:opacity-50 disabled:cursor-not-allowed`}
      title={label}
      aria-label={label}
    >
      <div
        className={`
          ${size} rounded-full flex items-center justify-center relative
          transition-all duration-150 active:scale-90 border shadow-lg
          ${bg}
          ${pulse ? "ring-2 ring-emerald-400/60 ring-offset-0" : ""}
        `}
      >
        <span className="text-white">{icon}</span>

        {/* Pulse ring */}
        {pulse && (
          <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-40" />
        )}

        {/* Badge (e.g. chevron for device selector) */}
        {badge && (
          <span className="absolute -top-1 -right-1 z-10">{badge}</span>
        )}
      </div>
      <span className="text-white/50 text-[10px] font-medium leading-none">
        {label}
      </span>
    </button>
  );
};

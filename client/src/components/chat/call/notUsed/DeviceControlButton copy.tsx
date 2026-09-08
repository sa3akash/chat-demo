// ─────────────────────────────────────────────────────────────────────────────
// DeviceControlButton — control button with a small chevron that opens DeviceSelector
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { DeviceKind, DeviceSelector } from "../DeviceSelector";
import { ChevronUp } from "lucide-react";

interface DeviceControlButtonProps {
  /** Main icon (e.g. Mic/MicOff) */
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onToggle: () => void;
  kind: DeviceKind;
  selectedDeviceId: string | null;
  onDeviceSelect: (id: string) => void;
  pulse?: boolean;
  small?: boolean;
}

/**
 * A ControlButton with a small chevron badge that opens a DeviceSelector popover.
 */
export const DeviceControlButton: React.FC<DeviceControlButtonProps> = ({
  icon,
  label,
  active,
  onToggle,
  kind,
  selectedDeviceId,
  onDeviceSelect,
  pulse = false,
  small = false,
}) => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const size = small ? "w-12 h-12" : "w-14 h-14";

  const bg = active
    ? "bg-white/15 hover:bg-white/25 border-white/15"
    : "bg-red-500/85 hover:bg-red-500 border-red-400/30";

  return (
    <div className="relative flex flex-col items-center gap-1.5">
      {/* Device selector popover */}
      <DeviceSelector
        kind={kind}
        selectedDeviceId={selectedDeviceId}
        onSelect={onDeviceSelect}
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
      />

      <div className="relative inline-flex">
        {/* Main action button */}
        <button
          type="button"
          onClick={onToggle}
          className={`${size} rounded-full flex items-center justify-center relative
                transition-all duration-150 active:scale-90 border shadow-lg
                ${bg}
                ${pulse ? "ring-2 ring-emerald-400/60 ring-offset-0" : ""}`}
          title={label}
          aria-label={label}
        >
          <span className="text-white">{icon}</span>
          {pulse && (
            <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-40 pointer-events-none" />
          )}
        </button>

        {/* Chevron badge — opens device selector */}
        <button
          type="button"
          onClick={() => setSelectorOpen((o) => !o)}
          className="absolute -top-1 -right-1 z-10 w-4.5 h-4.5 rounded-full
               bg-zinc-800 border border-white/20 flex items-center justify-center
               hover:bg-zinc-700 transition-colors"
          title={`Select ${
            kind === "audioinput"
              ? "microphone"
              : kind === "audiooutput"
                ? "speaker"
                : "camera"
          }`}
          aria-label="Select device"
          aria-expanded={selectorOpen}
        >
          <ChevronUp
            className={`w-2.5 h-2.5 text-white/70 transition-transform duration-150 ${
              selectorOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>
      </div>

      <span className="text-white/50 text-[10px] font-medium leading-none">
        {label}
      </span>
    </div>
  );
};

{
  /* Main button */
}
{
  /* 
      <button
        onClick={onToggle}
        className={`${size} rounded-full flex items-center justify-center relative
                    transition-all duration-150 active:scale-90 border shadow-lg
                    ${bg}
                    ${pulse ? "ring-2 ring-emerald-400/60 ring-offset-0" : ""}`}
        title={label}
        aria-label={label}
      >
        <span className="text-white">{icon}</span>
        {pulse && (
          <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-40" />
        )}

        {/* Chevron badge — opens device selector */
}
{
  /*<button
          onClick={(e) => {
            e.stopPropagation();
            setSelectorOpen((o) => !o);
          }}
          className="absolute -top-1 -right-1 z-10 w-4.5 h-4.5 rounded-full
                     bg-zinc-800 border border-white/20 flex items-center justify-center
                     hover:bg-zinc-700 transition-colors"
          title={`Select ${kind === "audioinput" ? "microphone" : kind === "audiooutput" ? "speaker" : "camera"}`}
          aria-label="Select device"
        >
          <ChevronUp
            className="w-2.5 h-2.5 text-white/70"
            style={{
              transform: selectorOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 150ms",
            }}
          />
        </button>
      </button>} */
}

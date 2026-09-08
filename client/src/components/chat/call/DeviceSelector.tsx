"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, Mic, Video, Volume2, Check } from "lucide-react";

export type DeviceKind = "audioinput" | "audiooutput" | "videoinput";

interface DeviceSelectorProps {
  kind: DeviceKind;
  /** The currently selected device ID */
  selectedDeviceId: string | null;
  /** Called when the user picks a different device */
  onSelect: (deviceId: string) => void;
  /** Show/hide the popover */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const kindIcon: Record<DeviceKind, React.ReactNode> = {
  audioinput: <Mic className="w-3.5 h-3.5" />,
  audiooutput: <Volume2 className="w-3.5 h-3.5" />,
  videoinput: <Video className="w-3.5 h-3.5" />,
};

const kindLabel: Record<DeviceKind, string> = {
  audioinput: "Microphone",
  audiooutput: "Speaker",
  videoinput: "Camera",
};

/**
 * Floating device-picker popover.
 * Enumerates real devices via `navigator.mediaDevices.enumerateDevices`.
 * Place this near its trigger button (position: relative on parent).
 */
export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  kind,
  selectedDeviceId,
  onSelect,
  open,
  onOpenChange,
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const loadDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === kind));
    } catch {
      // permissions not granted yet — list will be empty
    }
  }, [kind]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        loadDevices();
      });
    }
  }, [open, loadDevices]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50
                 w-60 rounded-2xl overflow-hidden
                 bg-zinc-900/95 backdrop-blur-xl border border-white/10
                 shadow-2xl shadow-black/60 animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 text-white/60 text-xs font-semibold tracking-wider uppercase">
        {kindIcon[kind]}
        <span>{kindLabel[kind]}</span>
      </div>

      {/* Device list */}
      <ul className="py-1 max-h-48 overflow-y-auto">
        {devices.length === 0 ? (
          <li className="px-4 py-3 text-white/30 text-sm text-center">
            No devices found
          </li>
        ) : (
          devices.map((device) => {
            const isSelected =
              selectedDeviceId === device.deviceId ||
              (!selectedDeviceId && device.deviceId === "default");
            return (
              <li key={device.deviceId}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left
                              transition-colors hover:bg-white/8 active:bg-white/12
                              ${isSelected ? "text-indigo-300" : "text-white/75"}`}
                  onClick={() => {
                    onSelect(device.deviceId);
                    onOpenChange(false);
                  }}
                >
                  <span className="flex-1 truncate">
                    {device.label || `Device ${devices.indexOf(device) + 1}`}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DeviceControlButton — control button with a small chevron that opens DeviceSelector
// ─────────────────────────────────────────────────────────────────────────────

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

      {/* Main button */}
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

        {/* Chevron badge — opens device selector */}
        <button
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
      </button>

      <span className="text-white/50 text-[10px] font-medium leading-none">
        {label}
      </span>
    </div>
  );
};

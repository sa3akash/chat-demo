"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Video, Volume2, Check } from "lucide-react";

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
  triggerRef?: React.RefObject<HTMLElement | null>;
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
  triggerRef,
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
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;

      // Ignore click if it's inside the popover OR inside the trigger button
      if (
        ref.current?.contains(target) ||
        triggerRef?.current?.contains(target)
      ) {
        return;
      }

      onOpenChange(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open, onOpenChange, triggerRef]);

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
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" />
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

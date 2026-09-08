"use client";

import React from "react";
import { MicOff, VideoOff } from "lucide-react";
import { VolumeRing } from "./VolumeRing";
import { SpeakingIndicator } from "./SpeakingIndicator";

interface VideoTileProps {
  /** The MediaStream to display */
  stream: MediaStream | null;
  /** If true, the video feed is intentionally off */
  videoOff: boolean;
  /** If true, the audio is muted */
  audioMuted?: boolean;
  /** Whether this is speaking right now */
  speaking?: boolean;
  /** Volume 0..1 — used for the ring animation */
  volume?: number;
  /** Initials / fallback text shown when video is off */
  initials: string;
  /** Label displayed at the bottom (e.g. "You") */
  label?: string;
  /** Mirror horizontally — useful for local self-view */
  mirror?: boolean;
  /** Mute the HTML audio element (local) */
  muted?: boolean;
  /** Extra class names for the container */
  className?: string;
  /** Compact PiP-style layout */
  compact?: boolean;
  /** Accent colour for the avatar / ring */
  accentColor?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

/**
 * A unified video tile that handles:
 *  - Live video stream
 *  - Black-screen fallback with avatar when video is off
 *  - Mute / VideoOff badge overlays
 *  - Speaking animation ring
 *  - Compact PiP mode
 */
export const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  videoOff,
  audioMuted = false,
  speaking = false,
  volume = 0,
  initials,
  label,
  mirror = false,
  muted = false,
  className = "",
  compact = false,
  accentColor = "#6366f1",
  videoRef,
}) => {
  const internalRef = React.useRef<HTMLVideoElement>(null);
  const ref = videoRef ?? internalRef;

  // Attach stream to video element
  React.useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream, ref]);

  const avatarSize = compact ? "w-10 h-10 text-sm" : "w-28 h-28 text-4xl";
  const ringSize = compact ? 48 : 128;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-zinc-950 ${className}`}
    >
      {/* ── Live video ─────────────────────────────────────── */}
      {!videoOff && stream && (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: mirror ? "scaleX(-1)" : undefined }}
        />
      )}

      {/* ── Black-screen fallback (camera off) ─────────────── */}
      {(videoOff || !stream) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
          {/* Volume / speaking ring */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: ringSize, height: ringSize }}
          >
            <VolumeRing
              volume={volume}
              color={accentColor}
              size={ringSize}
              rings={3}
              active={speaking}
            />
            {/* Avatar */}
            <div
              className={`relative z-10 rounded-full flex items-center justify-center font-bold text-white shadow-2xl border-2 border-white/10 ${avatarSize}`}
              style={{
                background: `linear-gradient(135deg, ${accentColor}cc 0%, ${accentColor}66 100%)`,
                // subtle breathing when speaking
                transform: `scale(${1 + volume * 0.06})`,
                transition: "transform 80ms ease-out",
              }}
            >
              {initials}
            </div>
          </div>

          {!compact && (
            <div className="mt-3 flex items-center gap-2">
              {videoOff && (
                <span className="flex items-center gap-1 text-white/40 text-xs">
                  <VideoOff className="w-3.5 h-3.5" />
                  Camera off
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Overlays ────────────────────────────────────────── */}

      {/* Mute badge */}
      {audioMuted && (
        <div
          className={`absolute ${compact ? "top-1 right-1" : "top-3 right-3"} z-30`}
        >
          <div className="w-7 h-7 rounded-full bg-red-500/90 flex items-center justify-center shadow-lg">
            <MicOff className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}

      {/* Speaking indicator */}
      {speaking && !audioMuted && (
        <div
          className={`absolute ${compact ? "bottom-1 left-1/2 -translate-x-1/2" : "bottom-3 left-1/2 -translate-x-1/2"} z-30`}
        >
          <div className="flex gap-0.5 items-end bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
            <SpeakingIndicator speaking variant="bars" color="#34d399" />
          </div>
        </div>
      )}

      {/* Name label */}
      {label && (
        <div
          className={`absolute ${compact ? "bottom-1 left-1 text-[9px]" : "bottom-3 left-3 text-xs"} z-30 px-1.5 py-0.5 rounded bg-black/50 text-white/80 font-medium`}
        >
          {label}
        </div>
      )}
    </div>
  );
};

"use client";

import React from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { useWaveform } from "@/hooks/useWaveform";

interface WaveformPlayerProps {
  audioUrl?: string;
  isMine?: boolean;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  audioUrl,
  isMine = false,
}) => {
  const {
    containerRef,
    isPlaying,
    isLoading,
    isReady,
    duration,
    currentTime,
    speed,
    togglePlay,
    cycleSpeed,
    formatTime,
  } = useWaveform({ audioUrl, isMine });

  return (
    <div
      className={`flex items-center gap-2.5 py-1 px-1 rounded-2xl min-w-[220px] max-w-[320px] ${
        isMine ? "text-primary-foreground" : "text-foreground"
      }`}
    >
      {/* Play / Pause / Loading Button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!isReady || isLoading}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-xs disabled:opacity-60 ${
          isMine
            ? "bg-primary-foreground text-primary"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform Canvas + Time */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* WaveSurfer mounts here */}
        <div
          ref={containerRef}
          className="w-full cursor-pointer"
          style={{ minHeight: 28 }}
        />

        {/* Time display */}
        <div className="flex items-center justify-between mt-0.5 text-[10px] opacity-70 font-mono select-none">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      {/* Speed Control */}
      <button
        type="button"
        onClick={cycleSpeed}
        disabled={!isReady}
        className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold transition-colors disabled:opacity-50 ${
          isMine
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
            : "bg-muted hover:bg-muted/80 text-muted-foreground"
        }`}
      >
        {speed}x
      </button>
    </div>
  );
};

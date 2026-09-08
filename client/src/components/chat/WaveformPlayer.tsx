"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

interface WaveformPlayerProps {
  audioUrl?: string;
  isMine?: boolean;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  audioUrl = "https://actions.google.com/sounds/v1/speech/greeting_male.ogg",
  isMine = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    let ws: any = null;
    let destroyed = false;

    // Dynamic import to avoid SSR issues
    import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      if (destroyed || !containerRef.current) return;

      const waveColor = isMine ? "rgba(255, 255, 255, 0.40)" : "rgba(100, 116, 139, 0.45)";
      const progressColor = isMine ? "#ffffff" : "#3b82f6";

      ws = WaveSurfer.create({
        container: containerRef.current!,
        waveColor,
        progressColor,
        cursorColor: "transparent",
        barWidth: 2.5,
        barGap: 2,
        barRadius: 2,
        height: 28,
        normalize: true,
        url: audioUrl,
      });

      waveSurferRef.current = ws;

      ws.on("ready", () => {
        if (!destroyed) {
          setIsReady(true);
          setIsLoading(false);
          setDuration(ws.getDuration());
        }
      });

      ws.on("audioprocess", () => {
        if (!destroyed) setCurrentTime(ws.getCurrentTime());
      });

      ws.on("play", () => { if (!destroyed) setIsPlaying(true); });
      ws.on("pause", () => { if (!destroyed) setIsPlaying(false); });
      ws.on("finish", () => {
        if (!destroyed) {
          setIsPlaying(false);
          setCurrentTime(0);
        }
      });

      ws.on("error", (err: Error) => {
        console.warn("WaveSurfer error:", err?.message || err);
        if (!destroyed) {
          setIsReady(true);
          setIsLoading(false);
          setDuration(0);
        }
      });
    }).catch((err) => {
      console.warn("Failed to load WaveSurfer:", err);
      if (!destroyed) {
        setIsLoading(false);
        setIsReady(true);
      }
    });

    return () => {
      destroyed = true;
      if (ws) {
        try { ws.destroy(); } catch {}
        waveSurferRef.current = null;
      }
    };
  }, [audioUrl, isMine]);

  const togglePlay = () => {
    if (!waveSurferRef.current || !isReady) return;
    waveSurferRef.current.playPause();
  };

  const cycleSpeed = () => {
    if (!waveSurferRef.current) return;
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    waveSurferRef.current.setPlaybackRate(nextSpeed);
    setSpeed(nextSpeed);
  };

  const formatTime = (timeInSec: number) => {
    const mins = Math.floor(timeInSec / 60);
    const secs = Math.floor(timeInSec % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex items-center gap-2.5 py-1 px-1 rounded-2xl min-w-[220px] max-w-[320px] ${
        isMine ? "text-primary-foreground" : "text-foreground"
      }`}
    >
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!isReady}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-xs disabled:opacity-60 ${
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

      {/* WaveSurfer Container */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div
          ref={containerRef}
          className="w-full cursor-pointer"
          style={{ minHeight: 28 }}
        />
        <div className="flex items-center justify-between mt-0.5 text-[10px] opacity-75 font-mono">
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PlaybackSpeed = 1 | 1.5 | 2;

export interface UseWaveformOptions {
  audioUrl?: string;
  isMine?: boolean;
}

export interface UseWaveformReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  isPlaying: boolean;
  isLoading: boolean;
  isReady: boolean;
  duration: number;
  currentTime: number;
  speed: PlaybackSpeed;
  togglePlay: () => void;
  cycleSpeed: () => void;
  formatTime: (sec: number) => string;
}

export function useWaveform({ audioUrl, isMine = false }: UseWaveformOptions): UseWaveformReturn {
  const containerRef = useRef<HTMLDivElement>(null!);
  const waveSurferRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  useEffect(() => {
    if (!audioUrl) {
      setIsLoading(false);
      return;
    }

    let destroyed = false;
    let ws: any = null;

    setIsPlaying(false);
    setIsReady(false);
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);

    import("wavesurfer.js")
      .then(({ default: WaveSurfer }) => {
        if (destroyed || !containerRef.current) return;

        const waveColor = isMine
          ? "rgba(255,255,255,0.40)"
          : "rgba(100,116,139,0.45)";
        const progressColor = isMine ? "#ffffff" : "#3b82f6";

        ws = WaveSurfer.create({
          container: containerRef.current,
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
          if (destroyed) return;
          setIsReady(true);
          setIsLoading(false);
          setDuration(ws.getDuration());
        });

        ws.on("audioprocess", () => {
          if (!destroyed) setCurrentTime(ws.getCurrentTime());
        });

        ws.on("seeking", () => {
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
          console.warn("WaveSurfer error:", err?.message ?? err);
          if (!destroyed) {
            setIsLoading(false);
            setIsReady(false);
          }
        });
      })
      .catch((err) => {
        console.warn("WaveSurfer import failed:", err);
        if (!destroyed) {
          setIsLoading(false);
          setIsReady(false);
        }
      });

    return () => {
      destroyed = true;
      if (ws) {
        try { ws.destroy(); } catch { /* ignore */ }
      }
      waveSurferRef.current = null;
    };
  }, [audioUrl, isMine]);

  const togglePlay = useCallback(() => {
    if (waveSurferRef.current && isReady) {
      waveSurferRef.current.playPause();
    }
  }, [isReady]);

  const cycleSpeed = useCallback(() => {
    if (!waveSurferRef.current) return;
    const next: PlaybackSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    waveSurferRef.current.setPlaybackRate(next);
    setSpeed(next);
  }, [speed]);

  const formatTime = useCallback((sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  return {
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
  };
}

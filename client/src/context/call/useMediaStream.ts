/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { CallType } from "./types";
import type { EmitFn } from "./types";
import type { CallRefs } from "./useCallRefs";

// ─────────────────────────────────────────────────────────────────────────────
// Volume analyser — works on any MediaStream; fires ~60fps via RAF
// ─────────────────────────────────────────────────────────────────────────────
function createVolumeAnalyser(
  stream: MediaStream,
  onVolume: (v: number) => void,
): () => void {
  let rafId = 0;
  let audioCtx: AudioContext | null = null;
  try {
    audioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      // RMS of lower 2/3 freq bins (voice range) → 0..1
      const voice = data.slice(0, Math.floor(data.length * 0.66));
      const rms = Math.sqrt(
        voice.reduce((s, v) => s + v * v, 0) / voice.length,
      );
      onVolume(Math.min(rms / 96, 1));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  } catch {
    // AudioContext unavailable — keep volume at 0
  }
  return () => {
    cancelAnimationFrame(rafId);
    audioCtx?.close().catch(() => {});
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

interface UseMediaStreamOptions {
  refs: Pick<
    CallRefs,
    "localStreamRef" | "localVolCleanupRef" | "remoteVolCleanupRef"
  >;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callState: string;
  setLocalStream: (s: MediaStream | null) => void;
  emit?: EmitFn;
}

/**
 * Manages:
 *  - getUserMedia (with silent fallback)
 *  - local + remote volume analysers (60fps RAF)
 */
export function useMediaStream({
  refs,
  localStream,
  remoteStream,
  callState,
  setLocalStream,
}: UseMediaStreamOptions) {
  const [localVolume, setLocalVolume] = useState(0);
  const [remoteVolume, setRemoteVolume] = useState(0);

  // ── Local volume analyser ─────────────────────────────────────────────────
  useEffect(() => {
    if (!localStream) {
      queueMicrotask(() => setLocalVolume(0));
      return;
    }

    const t = setTimeout(() => {
      refs.localVolCleanupRef.current = createVolumeAnalyser(
        localStream,
        setLocalVolume,
      );
    }, 300);
    return () => {
      clearTimeout(t);
      refs.localVolCleanupRef.current?.();
    };
  }, [localStream, refs.localVolCleanupRef]);

  // ── Remote volume analyser ────────────────────────────────────────────────
  useEffect(() => {
    if (!remoteStream || callState !== "connected") {
      queueMicrotask(() => setRemoteVolume(0));
      return;
    }

    const t = setTimeout(() => {
      refs.remoteVolCleanupRef.current = createVolumeAnalyser(
        remoteStream,
        setRemoteVolume,
      );
    }, 300);
    return () => {
      clearTimeout(t);
      refs.remoteVolCleanupRef.current?.();
    };
  }, [remoteStream, callState, refs.remoteVolCleanupRef]);

  // ── getUserMedia ──────────────────────────────────────────────────────────
  const getMedia = useCallback(
    async (type: CallType): Promise<MediaStream> => {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          type === "video"
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user",
              }
            : false,
      };
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        refs.localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (err) {
        console.warn("getUserMedia failed, using silent fallback:", err);
        const audioCtx = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        const osc = audioCtx.createOscillator();
        const dst = audioCtx.createMediaStreamDestination();
        osc.connect(dst);
        osc.start();
        const fallback = new MediaStream([dst.stream.getAudioTracks()[0]]);
        refs.localStreamRef.current = fallback;
        setLocalStream(fallback);
        return fallback;
      }
    },
    [refs.localStreamRef, setLocalStream],
  );

  return { localVolume, remoteVolume, getMedia };
}

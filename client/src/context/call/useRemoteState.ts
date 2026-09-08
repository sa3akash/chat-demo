/* eslint-disable react-hooks/immutability */
"use client";

import { useEffect, useState } from "react";
import type { CallRefs } from "./useCallRefs";

interface UseRemoteStateOptions {
  refs: Pick<CallRefs, "durationTimerRef">;
  remoteStream: MediaStream | null;
  callState: string;
}

/**
 * Tracks:
 *  - Remote video mute state (track-level events as fallback)
 *  - Remote audio mute state (track-level events as fallback)
 *  - Call duration counter (seconds since connected)
 *
 * Note: isRemoteMuted / isRemoteAudioMuted are also updated authoritatively
 * by the call:media-state socket signal in useCallSignaling — these track-level
 * listeners act as a secondary fallback.
 */
export function useRemoteState({
  refs,
  remoteStream,
  callState,
}: UseRemoteStateOptions) {
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // ── Remote video track mute detection ────────────────────────────────────
  useEffect(() => {
    if (!remoteStream) {
      queueMicrotask(() => {
        setIsRemoteMuted(false);
      });
      return;
    }

    const check = () => {
      const hasVideo = remoteStream
        .getVideoTracks()
        .some((t) => t.enabled && t.readyState === "live");
      setIsRemoteMuted(!hasVideo);
    };
    check();
    remoteStream.getVideoTracks().forEach((t) => {
      t.addEventListener("mute", check);
      t.addEventListener("unmute", check);
      t.addEventListener("ended", check);
    });
    return () =>
      remoteStream.getVideoTracks().forEach((t) => {
        t.removeEventListener("mute", check);
        t.removeEventListener("unmute", check);
        t.removeEventListener("ended", check);
      });
  }, [remoteStream]);

  // ── Remote audio track mute detection ────────────────────────────────────
  useEffect(() => {
    if (!remoteStream) {
      queueMicrotask(() => {
        setIsRemoteAudioMuted(false);
      });
      return;
    }

    const check = () => {
      const hasAudio = remoteStream
        .getAudioTracks()
        .some((t) => t.enabled && t.readyState === "live");
      setIsRemoteAudioMuted(!hasAudio);
    };
    check();
    remoteStream.getAudioTracks().forEach((t) => {
      t.addEventListener("mute", check);
      t.addEventListener("unmute", check);
      t.addEventListener("ended", check);
    });
    return () =>
      remoteStream.getAudioTracks().forEach((t) => {
        t.removeEventListener("mute", check);
        t.removeEventListener("unmute", check);
        t.removeEventListener("ended", check);
      });
  }, [remoteStream]);

  // ── Call duration counter ─────────────────────────────────────────────────
  useEffect(() => {
    if (callState === "connected") {
      queueMicrotask(() => {
        setCallDuration(0);
      });
      refs.durationTimerRef.current = setInterval(
        () => setCallDuration((s) => s + 1),
        1000,
      );
    } else {
      if (refs.durationTimerRef.current)
        clearInterval(refs.durationTimerRef.current);
      queueMicrotask(() => {
        setCallDuration(0);
      });
    }
    return () => {
      if (refs.durationTimerRef.current)
        clearInterval(refs.durationTimerRef.current);
    };
  }, [callState, refs.durationTimerRef]);

  return {
    isRemoteMuted,
    isRemoteAudioMuted,
    callDuration,
    // Expose setters so the signaling hook can override from socket events
    setIsRemoteMuted,
    setIsRemoteAudioMuted,
  };
}

/* eslint-disable react-hooks/immutability */
"use client";

import { useCallback } from "react";
import { ICE_SERVERS } from "./context";
import type { EmitFn } from "./types";
import type { CallRefs } from "./useCallRefs";

interface UsePeerConnectionOptions {
  refs: Pick<CallRefs, "pcRef" | "localVolCleanupRef" | "remoteVolCleanupRef" | "localStreamRef" | "screenStreamRef" | "screenSenderRef">;
  emit: EmitFn;
  setRemoteStream: (s: MediaStream | null) => void;
  setLocalStream: (s: MediaStream | null) => void;
  setCallState: (s: any) => void;
  setPartner: (p: any) => void;
  setActiveConversationId: (id: string | null) => void;
  setIsMicMuted: (v: boolean) => void;
  setIsCameraOff: (v: boolean) => void;
  setIsScreenSharing: (v: boolean) => void;
  setIsRemoteMuted: (v: boolean) => void;
  setIsRemoteAudioMuted: (v: boolean) => void;
  setLocalVolume: (v: number) => void;
  setRemoteVolume: (v: number) => void;
  setScreenStream: (s: MediaStream | null) => void;
}

/**
 * Creates and manages the RTCPeerConnection.
 * Also owns the cleanupMedia function that tears everything down.
 */
export function usePeerConnection({
  refs,
  emit,
  setRemoteStream,
  setLocalStream,
  setCallState,
  setPartner,
  setActiveConversationId,
  setIsMicMuted,
  setIsCameraOff,
  setIsScreenSharing,
  setIsRemoteMuted,
  setIsRemoteAudioMuted,
  setLocalVolume,
  setRemoteVolume,
  setScreenStream,
}: UsePeerConnectionOptions) {

  // ── Full teardown ─────────────────────────────────────────────────────────
  const cleanupMedia = useCallback(() => {
    // Local tracks
    refs.localStreamRef.current?.getTracks().forEach((t) => t.stop());
    refs.localStreamRef.current = null;
    setLocalStream(null);

    // Screen share
    refs.screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    refs.screenStreamRef.current = null;
    setScreenStream(null);
    refs.screenSenderRef.current = null;

    // Volume analysers
    refs.localVolCleanupRef.current?.();
    refs.localVolCleanupRef.current = null;
    refs.remoteVolCleanupRef.current?.();
    refs.remoteVolCleanupRef.current = null;

    // Peer connection
    refs.pcRef.current?.close();
    refs.pcRef.current = null;

    // Reset all state
    setRemoteStream(null);
    setCallState("idle");
    setPartner(null);
    setActiveConversationId(null);
    setIsMicMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    setIsRemoteMuted(false);
    setIsRemoteAudioMuted(false);
    setLocalVolume(0);
    setRemoteVolume(0);
  }, [
    refs,
    setLocalStream, setScreenStream, setRemoteStream, setCallState,
    setPartner, setActiveConversationId, setIsMicMuted, setIsCameraOff,
    setIsScreenSharing, setIsRemoteMuted, setIsRemoteAudioMuted,
    setLocalVolume, setRemoteVolume,
  ]);

  // ── Factory ───────────────────────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (targetUserId: string, conversationId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      refs.pcRef.current = pc;

      // Accumulate remote tracks into a MediaStream
      const remoteMs = new MediaStream();
      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          if (!remoteMs.getTrackById(track.id)) remoteMs.addTrack(track);
        });
        setRemoteStream(new MediaStream(remoteMs.getTracks()));
      };

      // Relay ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          emit("call:ice-candidate", { targetUserId, candidate: event.candidate, conversationId });
        }
      };

      // Drive call state from connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallState("connected");
        } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          cleanupMedia();
        }
      };

      // Restart ICE on failure
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") pc.restartIce?.();
      };

      return pc;
    },
    [refs, emit, setRemoteStream, setCallState, cleanupMedia],
  );

  return { cleanupMedia, createPeerConnection };
}

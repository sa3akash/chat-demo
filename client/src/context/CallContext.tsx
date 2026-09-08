/* eslint-disable react-hooks/immutability */
"use client";

import React, { useEffect, useState } from "react";
import { useSocket } from "./SocketContext";

// ── Sub-hooks ──────────────────────────────────────────────────────────────
import { CallContext }        from "./call/context";
import { useCallRefs }        from "./call/useCallRefs";
import { useMediaStream }     from "./call/useMediaStream";
import { useRemoteState }     from "./call/useRemoteState";
import { usePeerConnection }  from "./call/usePeerConnection";
import { useCallSignaling }   from "./call/useCallSignaling";
import { useMediaControls }   from "./call/useMediaControls";
import { useCallActions }     from "./call/useCallActions";

// Re-export the hook and types so consumers only import from this file
export { useCall }  from "./call/context";
export type { CallState, CallType } from "./call/types";

// ─────────────────────────────────────────────────────────────────────────────
// Provider — wires the sub-hooks together and publishes the unified context
// ─────────────────────────────────────────────────────────────────────────────
export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const { emit, subscribe } = useSocket();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [callState, setCallState]                     = useState<any>("idle");
  const [callType, setCallType]                       = useState<any>("audio");
  const [partner, setPartner]                         = useState<{ id: string; name: string } | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted]                   = useState(false);
  const [isCameraOff, setIsCameraOff]                 = useState(false);
  const [isScreenSharing, setIsScreenSharing]         = useState(false);
  const [localStream, setLocalStream]                 = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream]               = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream]               = useState<MediaStream | null>(null);
  const [activeAudioInputId, setActiveAudioInputId]   = useState<string | null>(null);
  const [activeAudioOutputId, setActiveAudioOutputId] = useState<string | null>(null);
  const [activeVideoInputId, setActiveVideoInputId]   = useState<string | null>(null);

  // ── Shared refs ────────────────────────────────────────────────────────────
  const refs = useCallRefs();

  // Keep stable refs in sync with state
  useEffect(() => { refs.callStateRef.current = callState; },            [callState, refs.callStateRef]);
  useEffect(() => { refs.partnerRef.current = partner; },                [partner, refs.partnerRef]);
  useEffect(() => { refs.activeConvIdRef.current = activeConversationId; }, [activeConversationId, refs.activeConvIdRef]);

  // ── Volume analysers + getUserMedia ────────────────────────────────────────
  const { localVolume, remoteVolume, getMedia } = useMediaStream({
    refs,
    localStream,
    remoteStream,
    callState,
    setLocalStream,
  });

  // ── Remote mute detection + call duration ──────────────────────────────────
  const {
    isRemoteMuted,
    isRemoteAudioMuted,
    callDuration,
    setIsRemoteMuted,
    setIsRemoteAudioMuted,
  } = useRemoteState({ refs, remoteStream, callState });

  // ── Peer connection factory + cleanup ──────────────────────────────────────
  const { cleanupMedia, createPeerConnection } = usePeerConnection({
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
    setLocalVolume: () => {},  // managed by useMediaStream — no-op here
    setRemoteVolume: () => {}, // managed by useMediaStream — no-op here
    setScreenStream,
  });

  // ── Screen share (stopScreenShare must be stable before startScreenShare) ──
  const { toggleMic, toggleCamera, switchAudioInput, switchAudioOutput, switchCamera, startScreenShare, stopScreenShare } =
    useMediaControls({
      refs,
      emit,
      setLocalStream,
      setScreenStream,
      setIsMicMuted,
      setIsCameraOff,
      setIsScreenSharing,
      setActiveAudioInputId,
      setActiveAudioOutputId,
      setActiveVideoInputId,
      stopScreenShareFn: async () => stopScreenShare(),
    });

  // ── Call lifecycle actions ─────────────────────────────────────────────────
  const { startCall, acceptCall, rejectCall, endCall } = useCallActions({
    refs,
    emit,
    partner,
    activeConversationId,
    callType,
    cleanupMedia,
    getMedia,
    createPeerConnection,
    setCallType,
    setPartner,
    setActiveConversationId,
    setCallState,
  });

  // ── Socket signaling ───────────────────────────────────────────────────────
  useCallSignaling({
    refs,
    subscribe,
    emit,
    cleanupMedia,
    setCallType,
    setPartner,
    setActiveConversationId,
    setCallState,
    setIsRemoteMuted,
    setIsRemoteAudioMuted,
  });

  // ── Provide ────────────────────────────────────────────────────────────────
  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        partner,
        callDuration,
        isMicMuted,
        isCameraOff,
        isScreenSharing,
        isRemoteMuted,
        isRemoteAudioMuted,
        localStream,
        remoteStream,
        screenStream,
        localVolume,
        remoteVolume,
        activeAudioInputId,
        activeAudioOutputId,
        activeVideoInputId,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMic,
        toggleCamera,
        startScreenShare,
        stopScreenShare,
        switchAudioInput,
        switchAudioOutput,
        switchCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

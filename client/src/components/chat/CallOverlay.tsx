"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCall } from "@/context/CallContext";
import { SpeakingKeyframes } from "./call/SpeakingIndicator";
import { IncomingCallScreen } from "./call/IncomingCallScreen";
import { VideoCallLayout } from "./call/VideoCallLayout";
import { AudioCallLayout } from "./call/AudioCallLayout";

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CallOverlay — thin orchestrator; all visual logic lives in sub-components
// ─────────────────────────────────────────────────────────────────────────────
export const CallOverlay: React.FC = () => {
  const {
    callState,
    callType,
    partner,
    callDuration,
    isMicMuted,
    isCameraOff,
    isScreenSharing,
    isRemoteMuted, // remote VIDEO camera off
    isRemoteAudioMuted, // remote AUDIO mic muted
    localStream,
    remoteStream,
    localVolume,
    remoteVolume,
    activeAudioInputId,
    activeAudioOutputId,
    activeVideoInputId,
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
  } = useCall();

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);
  // const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);

  // useEffect(
  //   () => setIsLocalSpeaking(localVolume > 0.06),

  //   [localVolume]);

  // useEffect(() => setIsRemoteSpeaking(remoteVolume > 0.06), [remoteVolume]);

  const isLocalSpeaking = localVolume > 0.06;
  const isRemoteSpeaking = remoteVolume > 0.06;

  // Bind remote audio
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Auto-hide controls (video call only)
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (callType === "video" && callState === "connected") {
      controlsTimerRef.current = setTimeout(
        () => setControlsVisible(false),
        4000,
      );
    }
  }, [callType, callState]);

  useEffect(() => {
    queueMicrotask(() => {
      resetControlsTimer();
    });
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [resetControlsTimer]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      overlayRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  if (callState === "idle") return null;

  const partnerInitials = (partner?.name ?? "U").slice(0, 2).toUpperCase();
  const isVideo = callType === "video";
  const isConnected = callState === "connected";

  // ── Derived flags ──────────────────────────────────────────────────────────
  // Remote video tile shows avatar when camera off OR not yet connected
  const remoteVideoOff = !isConnected || (isRemoteMuted && !isScreenSharing);
  // Local video tile shows avatar when camera toggled off
  const localVideoOff = isCameraOff;

  // Duration / status label
  const durationLabel = isConnected
    ? formatDuration(callDuration)
    : callState === "outgoing"
      ? "Ringing…"
      : "Connecting…";

  // ── Incoming ───────────────────────────────────────────────────────────────
  if (callState === "incoming") {
    return (
      <>
        <SpeakingKeyframes />
        <IncomingCallScreen
          partnerName={partner?.name ?? "Unknown"}
          partnerInitials={partnerInitials}
          isVideo={isVideo}
          onAccept={acceptCall}
          onDecline={rejectCall}
        />
      </>
    );
  }

  // ── Active call ────────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-100 bg-zinc-950 animate-in fade-in duration-200"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      <SpeakingKeyframes />
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {isVideo ? (
        <VideoCallLayout
          partnerName={partner?.name ?? ""}
          partnerInitials={partnerInitials}
          callDurationLabel={durationLabel}
          isConnected={isConnected}
          isScreenSharing={isScreenSharing}
          localStream={localStream}
          remoteStream={remoteStream}
          isMicMuted={isMicMuted}
          isCameraOff={isCameraOff}
          localVideoOff={localVideoOff}
          remoteVideoOff={remoteVideoOff}
          isRemoteCameraOff={isRemoteMuted}
          isRemoteAudioMuted={isRemoteAudioMuted}
          localVolume={localVolume}
          remoteVolume={remoteVolume}
          isLocalSpeaking={isLocalSpeaking}
          isRemoteSpeaking={isRemoteSpeaking}
          activeAudioInputId={activeAudioInputId}
          activeAudioOutputId={activeAudioOutputId}
          activeVideoInputId={activeVideoInputId}
          toggleMic={toggleMic}
          toggleCamera={toggleCamera}
          startScreenShare={startScreenShare}
          stopScreenShare={stopScreenShare}
          endCall={endCall}
          switchAudioInput={switchAudioInput}
          switchAudioOutput={switchAudioOutput}
          switchCamera={switchCamera}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          controlsVisible={controlsVisible}
        />
      ) : (
        <AudioCallLayout
          partnerName={partner?.name ?? "User"}
          partnerInitials={partnerInitials}
          callDurationLabel={durationLabel}
          callState={callState === "connected" ? "connected" : "outgoing"}
          isMicMuted={isMicMuted}
          isRemoteAudioMuted={isRemoteAudioMuted}
          isConnected={isConnected}
          isLocalSpeaking={isLocalSpeaking}
          isRemoteSpeaking={isRemoteSpeaking}
          localVolume={localVolume}
          remoteVolume={remoteVolume}
          activeAudioInputId={activeAudioInputId}
          activeAudioOutputId={activeAudioOutputId}
          toggleMic={toggleMic}
          endCall={endCall}
          switchAudioInput={switchAudioInput}
          switchAudioOutput={switchAudioOutput}
        />
      )}
    </div>
  );
};

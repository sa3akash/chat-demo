"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useCall } from "@/context/CallContext";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Maximize2,
  Minimize2,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronUp,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume ring — animated SVG ring that breathes with volume (0..1)
// ─────────────────────────────────────────────────────────────────────────────
const VolumeRing: React.FC<{
  volume: number;
  color?: string;
  size?: number;
  rings?: number;
}> = ({ volume, color = "#6366f1", size = 128, rings = 3 }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {Array.from({ length: rings }).map((_, i) => {
        const delay = i * 0.12;
        const scale = 1 + volume * (0.18 + i * 0.22);
        const opacity = Math.max(0, (volume * 0.7 - i * 0.15)) + 0.04;
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background: `radial-gradient(circle, ${color}30 0%, ${color}08 100%)`,
              border: `1.5px solid ${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`,
              transform: `scale(${scale})`,
              transition: `transform 80ms ease-out ${delay}s, opacity 80ms ease-out ${delay}s`,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Speaking badge
// ─────────────────────────────────────────────────────────────────────────────
const SpeakingDots: React.FC<{ speaking: boolean }> = ({ speaking }) =>
  speaking ? (
    <span className="inline-flex items-end gap-px h-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-0.5 rounded-full bg-emerald-400"
          style={{
            height: `${6 + i * 3}px`,
            animation: `speakBar 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
          }}
        />
      ))}
    </span>
  ) : null;

// ─────────────────────────────────────────────────────────────────────────────
// Main overlay
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
    isRemoteMuted,
    localStream,
    remoteStream,
    localVolume,
    remoteVolume,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
  } = useCall();

  // DOM refs for video elements
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Local UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPSwapped, setIsPiPSwapped] = useState(false);  // swap local↔remote
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Detect speaking
  useEffect(() => {
    setIsRemoteSpeaking(remoteVolume > 0.06);
  }, [remoteVolume]);

  useEffect(() => {
    setIsLocalSpeaking(localVolume > 0.06);
  }, [localVolume]);

  // Auto-hide controls after 4s of no mouse movement (video call only)
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (callType === "video" && callState === "connected") {
      controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 4000);
    }
  }, [callType, callState]);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [resetControlsTimer]);

  // Bind remote stream to video/audio
  useEffect(() => {
    if (!remoteStream) return;
    if (callType === "video" && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callType, callState]);

  // Bind local stream to local video (always — even before connected)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  // Fullscreen toggle
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

  // In video mode: if remote has no video OR we're screen sharing, show fallback
  const showRemoteVideoFallback = isVideo && isConnected && isRemoteMuted && !isScreenSharing;

  // ── Incoming call screen ──────────────────────────────────────────────────
  if (callState === "incoming") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-300">
        <div className="relative w-full max-w-sm mx-4 rounded-3xl overflow-hidden shadow-2xl">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#6366f140,_transparent_60%)]" />

          <div className="relative z-10 flex flex-col items-center gap-6 p-8">
            {/* Badge */}
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-semibold tracking-widest uppercase">
              {isVideo ? "📹 Incoming Video" : "📞 Incoming Call"}
            </span>

            {/* Avatar with volume rings */}
            <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
              <VolumeRing volume={0.3} color="#818cf8" size={120} rings={2} />
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl shadow-xl z-10 border-4 border-white/20">
                {partnerInitials}
              </div>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-white">{partner?.name ?? "Unknown"}</h2>
              <p className="text-white/50 text-sm animate-pulse">Calling you…</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-10 mt-2">
              <button
                onClick={rejectCall}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-90 transition-all flex items-center justify-center shadow-lg shadow-red-500/40">
                  <PhoneOff className="w-7 h-7 text-white" />
                </div>
                <span className="text-white/60 text-xs font-medium">Decline</span>
              </button>

              <button
                onClick={acceptCall}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-90 transition-all flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-bounce">
                  <Phone className="w-7 h-7 text-white" />
                </div>
                <span className="text-white/60 text-xs font-medium">Accept</span>
              </button>
            </div>
          </div>
        </div>

        {/* Keyframe for speaking dots */}
        <style>{`
          @keyframes speakBar {
            from { transform: scaleY(0.4); }
            to { transform: scaleY(1); }
          }
        `}</style>
      </div>
    );
  }

  // ── Active call (outgoing / connected) ────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-black animate-in fade-in duration-200"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* Hidden audio element — always active for remote audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* ── VIDEO CALL LAYOUT ─────────────────────────────────────────────── */}
      {isVideo ? (
        <div className="relative w-full h-full flex items-center justify-center bg-slate-950">

          {/* Remote video — full screen */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-300 ${isConnected && !showRemoteVideoFallback ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          />

          {/* Fallback when remote muted / not connected */}
          {(!isConnected || showRemoteVideoFallback) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
              <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
                <VolumeRing
                  volume={isConnected ? remoteVolume : 0.25}
                  color="#6366f1"
                  size={160}
                  rings={3}
                />
                <div className="w-36 h-36 rounded-full bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center text-white font-bold text-5xl shadow-2xl z-10 border-4 border-white/10">
                  {partnerInitials}
                </div>
              </div>
              <p className="mt-5 text-white/50 text-sm">
                {isConnected ? "Camera is off" : (callState === "outgoing" ? "Ringing…" : "Connecting…")}
              </p>
            </div>
          )}

          {/* Local video — PiP (bottom right) */}
          {isConnected && (
            <div
              className="absolute bottom-24 right-4 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 cursor-pointer group"
              style={{ width: 120, height: 160 }}
              onClick={() => setIsPiPSwapped((p) => !p)}
              title="Click to swap"
            >
              {!isCameraOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }} // mirror local
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-800">
                  <div className="w-10 h-10 rounded-full bg-indigo-600/40 flex items-center justify-center text-white text-sm font-bold border border-indigo-500/30">
                    {partnerInitials[0]}
                  </div>
                  <VideoOff className="w-4 h-4 text-white/40" />
                </div>
              )}
              {/* Speaking indicator on PiP */}
              {isLocalSpeaking && !isMicMuted && (
                <div className="absolute bottom-1 left-1 right-1 flex justify-center">
                  <div className="flex gap-0.5 items-end bg-black/40 rounded-full px-2 py-0.5">
                    <SpeakingDots speaking />
                  </div>
                </div>
              )}
              {/* Swap hint */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
            </div>
          )}

          {/* Top bar: partner name + speaking + call timer */}
          <div
            className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0"}`}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-base">{partner?.name}</span>
                {isRemoteSpeaking && <SpeakingDots speaking />}
              </div>
              <span className="text-white/50 text-xs mt-0.5">
                {isConnected ? formatDuration(callDuration) : callState === "outgoing" ? "Ringing…" : "Connecting…"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isScreenSharing && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/80 border border-indigo-400/40 text-white text-xs font-medium flex items-center gap-1">
                  <Monitor className="w-3 h-3" />
                  Sharing screen
                </span>
              )}
              <button
                onClick={toggleFullscreen}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-all"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Bottom controls bar */}
          <div
            className={`absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-3 px-6 pb-8 pt-16 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${controlsVisible || !isConnected ? "opacity-100" : "opacity-0"}`}
          >
            <div className="flex items-center gap-3">
              {/* Mic */}
              <ControlButton
                active={!isMicMuted}
                icon={isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                label={isMicMuted ? "Unmute" : "Mute"}
                onClick={toggleMic}
                pulse={isLocalSpeaking && !isMicMuted}
              />

              {/* Camera */}
              <ControlButton
                active={!isCameraOff}
                icon={isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                label={isCameraOff ? "Cam On" : "Cam Off"}
                onClick={toggleCamera}
              />

              {/* Screen share */}
              <ControlButton
                active={!isScreenSharing}
                icon={isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                label={isScreenSharing ? "Stop Share" : "Share"}
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                accent={isScreenSharing}
              />

              {/* End call */}
              <button
                onClick={endCall}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 active:scale-90 transition-all flex flex-col items-center justify-center shadow-lg shadow-red-500/30"
                title="End call"
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
            </div>
            <p className="text-white/30 text-xs">Tap screen to show controls</p>
          </div>
        </div>

      ) : (
        // ── AUDIO CALL LAYOUT ───────────────────────────────────────────────
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
          <div className="relative w-full max-w-sm mx-4 rounded-3xl overflow-hidden shadow-2xl border border-white/5">
            {/* Ambient gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-purple-950/90" />
            <div
              className="absolute inset-0 transition-opacity duration-150"
              style={{
                background: `radial-gradient(ellipse at 50% 50%, rgba(99,102,241,${0.05 + Math.max(localVolume, remoteVolume) * 0.2}) 0%, transparent 70%)`,
              }}
            />

            <div className="relative z-10 flex flex-col items-center gap-6 p-8">
              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : callState === "outgoing" ? "bg-amber-400 animate-ping" : "bg-indigo-400 animate-pulse"}`}
                />
                <span className="text-white/60 text-xs font-semibold tracking-wider uppercase">
                  {callState === "outgoing" ? "Calling" : callState === "connected" ? "Voice Call" : "Incoming"}
                </span>
              </div>

              {/* Avatar + volume rings */}
              <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
                {/* Remote speaking rings */}
                <VolumeRing
                  volume={isConnected ? remoteVolume : 0.25}
                  color="#6366f1"
                  size={160}
                  rings={3}
                />
                {/* Local speaking inner ring */}
                {isConnected && (
                  <div
                    className="absolute rounded-full border-2 border-emerald-400 transition-all duration-75"
                    style={{
                      width: `${140 + localVolume * 20}px`,
                      height: `${140 + localVolume * 20}px`,
                      opacity: 0.1 + localVolume * 0.8,
                    }}
                  />
                )}
                <div
                  className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center text-white font-bold text-4xl shadow-2xl z-10 border-4 border-white/10 transition-transform duration-75"
                  style={isConnected ? { transform: `scale(${1 + Math.max(localVolume, remoteVolume) * 0.06})` } : {}}
                >
                  {partnerInitials}
                </div>
              </div>

              {/* Partner name + speaking indicator */}
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-2xl font-bold text-white">{partner?.name ?? "User"}</h2>
                  {isRemoteSpeaking && <SpeakingDots speaking />}
                </div>
                <p className="text-white/50 text-sm">
                  {isConnected ? formatDuration(callDuration) : callState === "outgoing" ? "Ringing…" : "Connecting…"}
                </p>
              </div>

              {/* Mic muted banner */}
              {isMicMuted && isConnected && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30">
                  <MicOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-red-300 text-xs font-medium">Microphone muted</span>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-4 mt-2">
                {isConnected && (
                  <ControlButton
                    active={!isMicMuted}
                    icon={isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    label={isMicMuted ? "Unmute" : "Mute"}
                    onClick={toggleMic}
                    pulse={isLocalSpeaking && !isMicMuted}
                    small
                  />
                )}

                {/* End / Cancel */}
                <button
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-90 transition-all flex items-center justify-center shadow-xl shadow-red-500/30"
                  title="End call"
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>

                {isConnected && (
                  <ControlButton
                    active
                    icon={<Volume2 className="w-5 h-5" />}
                    label="Speaker"
                    onClick={() => {}}
                    small
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global styles */}
      <style>{`
        @keyframes speakBar {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Control button — reusable pill-style button for call controls
// ─────────────────────────────────────────────────────────────────────────────
const ControlButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  pulse?: boolean;
  accent?: boolean;
  small?: boolean;
}> = ({ active, icon, label, onClick, pulse, accent, small }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1.5 group`}
    title={label}
  >
    <div
      className={`
        ${small ? "w-12 h-12" : "w-14 h-14"} rounded-full flex items-center justify-center
        transition-all duration-150 active:scale-90 relative
        ${accent
          ? "bg-indigo-500 hover:bg-indigo-400 border border-indigo-300/30"
          : active
          ? "bg-white/15 hover:bg-white/25 border border-white/15"
          : "bg-red-500/80 hover:bg-red-500 border border-red-400/30"
        }
        ${pulse ? "ring-2 ring-emerald-400/50 ring-offset-0" : ""}
      `}
    >
      <span className="text-white">{icon}</span>
      {pulse && (
        <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-40" />
      )}
    </div>
    <span className="text-white/50 text-[10px] font-medium">{label}</span>
  </button>
);

"use client";

import React from "react";
import { PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";
import { VolumeRing } from "./VolumeRing";
import { SpeakingIndicator } from "./SpeakingIndicator";
import { ControlButton } from "./ControlButton";
import { DeviceControlButton } from "./DeviceSelector";

interface AudioCallLayoutProps {
  partnerName: string;
  partnerInitials: string;
  callDurationLabel: string;
  callState: "outgoing" | "connected";

  isMicMuted: boolean;
  isRemoteAudioMuted: boolean;
  isConnected: boolean;
  isLocalSpeaking: boolean;
  isRemoteSpeaking: boolean;
  localVolume: number;
  remoteVolume: number;

  activeAudioInputId: string | null;
  activeAudioOutputId: string | null;

  toggleMic: () => void;
  endCall: () => void;
  switchAudioInput: (id: string) => void;
  switchAudioOutput: (id: string) => void;
}

export const AudioCallLayout: React.FC<AudioCallLayoutProps> = ({
  partnerName,
  partnerInitials,
  callDurationLabel,
  callState,
  isMicMuted,
  isRemoteAudioMuted,
  isConnected,
  isLocalSpeaking,
  isRemoteSpeaking,
  localVolume,
  remoteVolume,
  activeAudioInputId,
  activeAudioOutputId,
  toggleMic,
  endCall,
  switchAudioInput,
  switchAudioOutput,
}) => {
  const ambientOpacity = 0.05 + Math.max(localVolume, remoteVolume) * 0.2;

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      <div className="relative w-full max-w-sm mx-4 rounded-3xl overflow-hidden shadow-2xl border border-white/5">
        {/* Ambient layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-purple-950/90" />
        <div
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, rgba(99,102,241,${ambientOpacity}) 0%, transparent 70%)`,
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 p-8">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected
                  ? "bg-emerald-400 animate-pulse"
                  : callState === "outgoing"
                    ? "bg-amber-400 animate-ping"
                    : "bg-indigo-400 animate-pulse"
              }`}
            />
            <span className="text-white/60 text-xs font-semibold tracking-wider uppercase">
              {callState === "outgoing" ? "Calling" : "Voice Call"}
            </span>
          </div>

          {/* Avatar + rings */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: 160, height: 160 }}
          >
            {/* Remote speaking ring */}
            <VolumeRing
              volume={isConnected ? remoteVolume : 0.25}
              color="#6366f1"
              size={160}
              rings={3}
              active={isConnected ? isRemoteSpeaking : true}
            />
            {/* Local speaking ring */}
            {isConnected && (
              <div
                className="absolute rounded-full border-2 border-emerald-400 transition-all duration-75"
                style={{
                  width: `${140 + localVolume * 20}px`,
                  height: `${140 + localVolume * 20}px`,
                  opacity: 0.08 + localVolume * 0.8,
                }}
              />
            )}
            {/* Avatar */}
            <div
              className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center text-white font-bold text-4xl shadow-2xl z-10 border-4 border-white/10 transition-transform duration-75"
              style={
                isConnected
                  ? { transform: `scale(${1 + Math.max(localVolume, remoteVolume) * 0.06})` }
                  : {}
              }
            >
              {partnerInitials}
            </div>

            {/* Remote audio mute badge on avatar */}
            {isConnected && isRemoteAudioMuted && (
              <div className="absolute bottom-1 right-1 z-20 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center border-2 border-zinc-900 shadow-lg">
                <MicOff className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>

          {/* Name + speaking */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-2xl font-bold text-white">{partnerName}</h2>
              {isConnected && isRemoteSpeaking && !isRemoteAudioMuted && (
                <SpeakingIndicator speaking variant="bars" color="#34d399" />
              )}
            </div>
            <p className="text-white/50 text-sm">{callDurationLabel}</p>
          </div>

          {/* My mute banner — only show when muted AND connected */}
          {isConnected && isMicMuted && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30">
              <MicOff className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-300 text-xs font-medium">Microphone muted</span>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-4 mt-2">
            {isConnected && (
              <DeviceControlButton
                icon={isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                label={isMicMuted ? "Unmute" : "Mute"}
                active={!isMicMuted}
                onToggle={toggleMic}
                kind="audioinput"
                selectedDeviceId={activeAudioInputId}
                onDeviceSelect={switchAudioInput}
                pulse={isLocalSpeaking && !isMicMuted}
                small
              />
            )}

            <ControlButton
              active
              danger
              icon={<PhoneOff className="w-7 h-7" />}
              label="End"
              onClick={endCall}
            />

            {isConnected && (
              <DeviceControlButton
                icon={<Volume2 className="w-5 h-5" />}
                label="Speaker"
                active
                onToggle={() => {}}
                kind="audiooutput"
                selectedDeviceId={activeAudioOutputId}
                onDeviceSelect={switchAudioOutput}
                small
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

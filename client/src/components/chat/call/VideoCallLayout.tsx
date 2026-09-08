"use client";

import React, { useState } from "react";
import {
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
} from "lucide-react";
import { SpeakingIndicator } from "./SpeakingIndicator";
import { VideoTile } from "./VideoTile";
import { ControlButton } from "./ControlButton";
import { DeviceControlButton } from "./DeviceControlButton";

interface VideoCallLayoutProps {
  // Call info
  partnerName: string;
  partnerInitials: string;
  callDurationLabel: string;
  isConnected: boolean;
  isScreenSharing: boolean;

  // Streams & state
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicMuted: boolean;
  isCameraOff: boolean;
  localVideoOff: boolean;
  remoteVideoOff: boolean;
  /** Remote VIDEO camera off */
  isRemoteCameraOff: boolean;
  /** Remote AUDIO mic muted */
  isRemoteAudioMuted: boolean;

  // Volume / speaking
  localVolume: number;
  remoteVolume: number;
  isLocalSpeaking: boolean;
  isRemoteSpeaking: boolean;

  // Device IDs
  activeAudioInputId: string | null;
  activeAudioOutputId: string | null;
  activeVideoInputId: string | null;

  // Handlers
  toggleMic: () => void;
  toggleCamera: () => void;
  startScreenShare: () => void;
  stopScreenShare: () => void;
  endCall: () => void;
  switchAudioInput: (id: string) => void;
  switchAudioOutput: (id: string) => void;
  switchCamera: (id: string) => void;

  // Fullscreen
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  controlsVisible: boolean;
}

export const VideoCallLayout: React.FC<VideoCallLayoutProps> = ({
  partnerName,
  partnerInitials,
  callDurationLabel,
  isConnected,
  isScreenSharing,
  localStream,
  remoteStream,
  isMicMuted,
  isCameraOff,
  localVideoOff,
  remoteVideoOff,
  isRemoteCameraOff,
  isRemoteAudioMuted,
  localVolume,
  remoteVolume,
  isLocalSpeaking,
  isRemoteSpeaking,
  activeAudioInputId,
  activeAudioOutputId,
  activeVideoInputId,
  toggleMic,
  toggleCamera,
  startScreenShare,
  stopScreenShare,
  endCall,
  switchAudioInput,
  switchAudioOutput,
  switchCamera,
  isFullscreen,
  onToggleFullscreen,
  controlsVisible,
}) => {
  const [isPiPSwapped, setIsPiPSwapped] = useState(false);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-zinc-950">

      {/* Remote full-screen tile */}
      <VideoTile
        stream={remoteVideoOff ? null : remoteStream}
        videoOff={remoteVideoOff}
        audioMuted={isConnected && isRemoteAudioMuted}
        speaking={isRemoteSpeaking}
        volume={isConnected ? remoteVolume : 0.25}
        initials={partnerInitials}
        label={partnerName}
        accentColor="#6366f1"
        className="absolute inset-0 w-full h-full"
      />

      {/* Local PiP */}
      {isConnected && (
        <div
          className="absolute bottom-24 right-4 z-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl cursor-pointer group transition-transform hover:scale-105"
          style={{ width: 120, height: 160 }}
          onClick={() => setIsPiPSwapped((p) => !p)}
          title="Click to swap"
        >
          <VideoTile
            stream={localStream}
            videoOff={localVideoOff}
            audioMuted={isMicMuted}
            speaking={isLocalSpeaking && !isMicMuted}
            volume={localVolume}
            initials="Me"
            label="You"
            mirror
            muted
            compact
            accentColor="#8b5cf6"
            className="w-full h-full"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <RotateCcw className="w-5 h-5 text-white" />
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-4
          bg-linear-to-b from-black/70 to-transparent transition-opacity duration-300
          ${controlsVisible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-base">{partnerName}</span>
            {isRemoteSpeaking && !isRemoteAudioMuted && (
              <SpeakingIndicator speaking variant="bars" color="#34d399" />
            )}
            {isRemoteAudioMuted && isConnected && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[10px]">
                <MicOff className="w-3 h-3" /> Muted
              </span>
            )}
          </div>
          <span className="text-white/50 text-xs mt-0.5">{callDurationLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {isScreenSharing && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/80 border border-indigo-400/40 text-white text-xs font-medium flex items-center gap-1">
              <Monitor className="w-3 h-3" /> Sharing screen
            </span>
          )}
          <button
            onClick={onToggleFullscreen}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-3 px-6 pb-8 pt-16
          bg-linear-to-t from-black/80 to-transparent transition-opacity duration-300
          ${controlsVisible || !isConnected ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex items-center gap-3">
          <DeviceControlButton
            icon={isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            label={isMicMuted ? "Unmute" : "Mute"}
            active={!isMicMuted}
            onToggle={toggleMic}
            kind="audioinput"
            selectedDeviceId={activeAudioInputId}
            onDeviceSelect={switchAudioInput}
            pulse={isLocalSpeaking && !isMicMuted}
          />
          <DeviceControlButton
            icon={isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            label={isCameraOff ? "Cam On" : "Cam Off"}
            active={!isCameraOff}
            onToggle={toggleCamera}
            kind="videoinput"
            selectedDeviceId={activeVideoInputId}
            onDeviceSelect={switchCamera}
          />
          <DeviceControlButton
            icon={<Volume2 className="w-5 h-5" />}
            label="Speaker"
            active
            onToggle={() => {}}
            kind="audiooutput"
            selectedDeviceId={activeAudioOutputId}
            onDeviceSelect={switchAudioOutput}
          />
          <ControlButton
            active={!isScreenSharing}
            icon={isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            label={isScreenSharing ? "Stop Share" : "Share"}
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            accent={isScreenSharing}
          />
          <ControlButton
            active
            danger
            icon={<PhoneOff className="w-6 h-6" />}
            label="End"
            onClick={endCall}
          />
        </div>
        <p className="text-white/30 text-xs">Tap screen to show controls</p>
      </div>
    </div>
  );
};

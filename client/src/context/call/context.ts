"use client";

import { createContext, useContext } from "react";
import type { CallType, CallState } from "./types";

export type { CallType, CallState };

export interface CallParticipant {
  id: string;
  name: string;
}

export interface CallContextType {
  callState: CallState;
  callType: CallType;
  partner: CallParticipant | null;
  callDuration: number;
  isMicMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  /** true when remote VIDEO camera is off (signalled via call:media-state) */
  isRemoteMuted: boolean;
  /** true when remote MIC is muted (signalled via call:media-state) */
  isRemoteAudioMuted: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenStream: MediaStream | null;
  /** 0.0–1.0 local mic volume (60fps) */
  localVolume: number;
  /** 0.0–1.0 remote audio volume (60fps) */
  remoteVolume: number;
  activeAudioInputId: string | null;
  activeAudioOutputId: string | null;
  activeVideoInputId: string | null;
  startCall: (
    recipientId: string,
    recipientName: string,
    conversationId: string,
    callType: CallType,
  ) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  switchAudioInput: (deviceId: string) => Promise<void>;
  switchAudioOutput: (deviceId: string) => Promise<void>;
  switchCamera: (deviceId: string) => Promise<void>;
}

export const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within a CallProvider");
  return ctx;
};

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/** Analyse a MediaStream and return 0.0–1.0 volume via a cleanup-returning setup */
function createVolumeAnalyser(
  stream: MediaStream,
  onVolume: (v: number) => void
): () => void {
  let rafId: number;
  let ctx: AudioContext | null = null;
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      // RMS-like average
      const sum = data.reduce((acc, v) => acc + v * v, 0);
      const rms = Math.sqrt(sum / data.length);
      onVolume(Math.min(rms / 128, 1)); // normalise to 0-1
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  } catch {
    // AudioContext not available, keep volume at 0
  }

  return () => {
    cancelAnimationFrame(rafId);
    ctx?.close();
  };
}
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import {
  CallAcceptedPayload,
  CallIceCandidatePayload,
  IncomingCallPayload,
} from "@/types/socket.client";

export type CallState = "idle" | "outgoing" | "incoming" | "connected";
export type CallType = "audio" | "video";

interface CallParticipant {
  id: string;
  name: string;
}

interface CallContextType {
  callState: CallState;
  callType: CallType;
  partner: CallParticipant | null;
  callDuration: number;
  isMicMuted: boolean;
  isCameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** 0.0 – 1.0: current microphone volume (updated ~60fps) */
  localVolume: number;
  /** 0.0 – 1.0: current remote audio volume (updated ~60fps) */
  remoteVolume: number;
  startCall: (
    recipientId: string,
    recipientName: string,
    conversationId: string,
    callType: CallType
  ) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const { emit, subscribe } = useSocket();
  const { user } = useAuth();

  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<CallType>("audio");
  const [partner, setPartner] = useState<CallParticipant | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localVolume, setLocalVolume] = useState(0);
  const [remoteVolume, setRemoteVolume] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const incomingOfferRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAnalyserCleanupRef = useRef<(() => void) | null>(null);
  const remoteAnalyserCleanupRef = useRef<(() => void) | null>(null);
  // Ref to avoid stale closure in socket event handler
  const callStateRef = useRef<CallState>("idle");
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // Volume analyser: local microphone
  useEffect(() => {
    if (localStream && callState === "connected") {
      localAnalyserCleanupRef.current?.();
      localAnalyserCleanupRef.current = createVolumeAnalyser(localStream, setLocalVolume);
    } else {
      localAnalyserCleanupRef.current?.();
      localAnalyserCleanupRef.current = null;
      setLocalVolume(0);
    }
    return () => {
      localAnalyserCleanupRef.current?.();
    };
  }, [localStream, callState]);

  // Volume analyser: remote audio
  useEffect(() => {
    if (remoteStream && callState === "connected") {
      remoteAnalyserCleanupRef.current?.();
      remoteAnalyserCleanupRef.current = createVolumeAnalyser(remoteStream, setRemoteVolume);
    } else {
      remoteAnalyserCleanupRef.current?.();
      remoteAnalyserCleanupRef.current = null;
      setRemoteVolume(0);
    }
    return () => {
      remoteAnalyserCleanupRef.current?.();
    };
  }, [remoteStream, callState]);

  // Call duration counter
  useEffect(() => {
    if (callState === "connected") {
      setCallDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      setCallDuration(0);
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [callState]);

  // Clean up WebRTC tracks and connection
  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    setCallState("idle");
    setPartner(null);
    setActiveConversationId(null);
    setIsMicMuted(false);
    setIsCameraOff(false);
  }, []);

  // Initialize or acquire media stream
  const getMedia = useCallback(async (type: CallType): Promise<MediaStream> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === "video" ? { width: 1280, height: 720 } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn("Could not acquire actual media devices, creating fallback audio context stream", err);
      // Fallback: create silent audio stream so WebRTC peer connection still negotiates smoothly
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      osc.connect(dst);
      osc.start();
      const track = dst.stream.getAudioTracks()[0];
      const fallbackStream = new MediaStream([track]);
      localStreamRef.current = fallbackStream;
      setLocalStream(fallbackStream);
      return fallbackStream;
    }
  }, []);

  // Initialize RTCPeerConnection
  const createPeerConnection = useCallback(
    (targetUserId: string, conversationId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // When remote tracks arrive
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          const newStream = new MediaStream([event.track]);
          setRemoteStream(newStream);
        }
      };

      // When local ICE candidate is found
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          emit("call:ice-candidate", {
            targetUserId,
            candidate: event.candidate,
            conversationId,
          });
        }
      };

      // Connection state changes
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallState("connected");
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          cleanupMedia();
        }
      };

      return pc;
    },
    [emit, cleanupMedia]
  );

  // 1. Start Outgoing Call
  const startCall = useCallback(
    async (
      recipientId: string,
      recipientName: string,
      conversationId: string,
      type: CallType
    ) => {
      cleanupMedia();
      setCallType(type);
      setPartner({ id: recipientId, name: recipientName });
      setActiveConversationId(conversationId);
      setCallState("outgoing");

      try {
        const stream = await getMedia(type);
        const pc = createPeerConnection(recipientId, conversationId);

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        emit("call:initiate", {
          recipientId,
          conversationId,
          callType: type,
          offer,
        });
      } catch (err) {
        console.error("Failed to start call", err);
        cleanupMedia();
      }
    },
    [cleanupMedia, getMedia, createPeerConnection, emit]
  );

  // 2. Accept Incoming Call
  const acceptCall = useCallback(async () => {
    if (!partner || !activeConversationId || !incomingOfferRef.current) return;

    try {
      const stream = await getMedia(callType);
      const pc = createPeerConnection(partner.id, activeConversationId);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      setCallState("connected");

      emit("call:accept", {
        callerId: partner.id,
        conversationId: activeConversationId,
        answer,
      });
    } catch (err) {
      console.error("Failed to accept call", err);
      cleanupMedia();
    }
  }, [partner, activeConversationId, callType, getMedia, createPeerConnection, emit, cleanupMedia]);

  // 3. Reject Incoming Call
  const rejectCall = useCallback(() => {
    if (partner && activeConversationId) {
      emit("call:reject", {
        callerId: partner.id,
        conversationId: activeConversationId,
      });
    }
    cleanupMedia();
  }, [partner, activeConversationId, emit, cleanupMedia]);

  // 4. End Active Call
  const endCall = useCallback(() => {
    if (partner && activeConversationId) {
      emit("call:end", {
        targetUserId: partner.id,
        conversationId: activeConversationId,
      });
    }
    cleanupMedia();
  }, [partner, activeConversationId, emit, cleanupMedia]);

  // 5. Toggle Microphone Mute
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // 6. Toggle Camera On/Off
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  }, []);

  // 7. Subscribe to WebSocket Call Signaling Events
  useEffect(() => {
    const unsubIncoming = subscribe("call:incoming", (data: IncomingCallPayload) => {
      if (callStateRef.current !== "idle") {
        // Busy: auto reject
        emit("call:reject", {
          callerId: data.callerId,
          conversationId: data.conversationId,
        });
        return;
      }

      setCallType(data.callType);
      setPartner({ id: data.callerId, name: data.callerName });
      setActiveConversationId(data.conversationId);
      incomingOfferRef.current = data.offer;
      setCallState("incoming");
    });

    const unsubAccepted = subscribe("call:accepted", async (data: CallAcceptedPayload) => {
      if (peerConnectionRef.current && data.answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          setCallState("connected");
        } catch (err) {
          console.error("Failed to set remote answer", err);
        }
      }
    });

    const unsubRejected = subscribe("call:rejected", () => {
      cleanupMedia();
    });

    const unsubEnded = subscribe("call:ended", () => {
      cleanupMedia();
    });

    const unsubIce = subscribe("call:ice-candidate", async (data: CallIceCandidatePayload) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error("Failed to add ICE candidate", err);
        }
      }
    });

    return () => {
      unsubIncoming();
      unsubAccepted();
      unsubRejected();
      unsubEnded();
      unsubIce();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, emit, cleanupMedia]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        partner,
        callDuration,
        isMicMuted,
        isCameraOff,
        localStream,
        remoteStream,
        localVolume,
        remoteVolume,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMic,
        toggleCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

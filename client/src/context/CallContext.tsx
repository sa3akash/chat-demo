"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const incomingOfferRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Ref to avoid stale closure in socket event handler
  const callStateRef = useRef<CallState>("idle");
  useEffect(() => { callStateRef.current = callState; }, [callState]);

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

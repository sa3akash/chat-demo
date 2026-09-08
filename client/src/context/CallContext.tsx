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

// ─────────────────────────────────────────────────────────────────────────────
// Volume analyser — works on ANY MediaStream (local mic or remote audio)
// Returns cleanup fn. Fires ~60fps via requestAnimationFrame.
// ─────────────────────────────────────────────────────────────────────────────
function createVolumeAnalyser(
  stream: MediaStream,
  onVolume: (v: number) => void
): () => void {
  let rafId = 0;
  let audioCtx: AudioContext | null = null;

  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      // RMS of lower 2/3 of freq bins (voice range) → 0..1
      const voiceBins = data.slice(0, Math.floor(data.length * 0.66));
      const sum = voiceBins.reduce((acc, v) => acc + v * v, 0);
      const rms = Math.sqrt(sum / voiceBins.length);
      onVolume(Math.min(rms / 96, 1)); // 96 ≈ comfortable speech RMS
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  } catch {
    // AudioContext unavailable — keep volume at 0
  }

  return () => {
    cancelAnimationFrame(rafId);
    audioCtx?.close().catch(() => {});
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
  isScreenSharing: boolean;
  isRemoteMuted: boolean;         // true when remote has no active video tracks
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenStream: MediaStream | null;
  /** 0.0–1.0 local mic volume (60fps) */
  localVolume: number;
  /** 0.0–1.0 remote audio volume (60fps) */
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
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within a CallProvider");
  return context;
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const [localVolume, setLocalVolume] = useState(0);
  const [remoteVolume, setRemoteVolume] = useState(0);

  // Refs — never trigger re-renders, always up-to-date
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const incomingOfferRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const localVolCleanupRef = useRef<(() => void) | null>(null);
  const remoteVolCleanupRef = useRef<(() => void) | null>(null);
  const callStateRef = useRef<CallState>("idle");

  // Keep callStateRef in sync for use inside stable closures
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // ── Volume analysers ──────────────────────────────────────────────────────

  // Local volume: run whenever we have a local stream (even during "outgoing"
  // so the caller sees their own voice rings immediately)
  useEffect(() => {
    localVolCleanupRef.current?.();
    localVolCleanupRef.current = null;

    if (localStream) {
      // Slight delay so AudioContext isn't created before user gesture
      const t = setTimeout(() => {
        localVolCleanupRef.current = createVolumeAnalyser(localStream, setLocalVolume);
      }, 300);
      return () => {
        clearTimeout(t);
        localVolCleanupRef.current?.();
      };
    } else {
      setLocalVolume(0);
    }
  }, [localStream]);

  // Remote volume: only when connected and stream exists
  useEffect(() => {
    remoteVolCleanupRef.current?.();
    remoteVolCleanupRef.current = null;

    if (remoteStream && callState === "connected") {
      const t = setTimeout(() => {
        remoteVolCleanupRef.current = createVolumeAnalyser(remoteStream, setRemoteVolume);
      }, 300);
      return () => {
        clearTimeout(t);
        remoteVolCleanupRef.current?.();
      };
    } else {
      setRemoteVolume(0);
    }
  }, [remoteStream, callState]);

  // Detect whether remote has active video (for muted/fallback indicator)
  useEffect(() => {
    if (!remoteStream) { setIsRemoteMuted(false); return; }
    const check = () => {
      const videoTracks = remoteStream.getVideoTracks();
      const hasActiveVideo = videoTracks.some((t) => t.enabled && t.readyState === "live");
      setIsRemoteMuted(!hasActiveVideo);
    };
    check();
    remoteStream.getVideoTracks().forEach((t) => {
      t.addEventListener("mute", check);
      t.addEventListener("unmute", check);
      t.addEventListener("ended", check);
    });
    return () => {
      remoteStream.getVideoTracks().forEach((t) => {
        t.removeEventListener("mute", check);
        t.removeEventListener("unmute", check);
        t.removeEventListener("ended", check);
      });
    };
  }, [remoteStream]);

  // ── Call duration counter ─────────────────────────────────────────────────
  useEffect(() => {
    if (callState === "connected") {
      setCallDuration(0);
      durationTimerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setCallDuration(0);
    }
    return () => { if (durationTimerRef.current) clearInterval(durationTimerRef.current); };
  }, [callState]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanupMedia = useCallback(() => {
    // Stop local camera/mic
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    // Stop screen share
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    screenSenderRef.current = null;

    // Volume analysers
    localVolCleanupRef.current?.();
    localVolCleanupRef.current = null;
    remoteVolCleanupRef.current?.();
    remoteVolCleanupRef.current = null;

    // Peer connection
    pcRef.current?.close();
    pcRef.current = null;

    setRemoteStream(null);
    setCallState("idle");
    setPartner(null);
    setActiveConversationId(null);
    setIsMicMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    setIsRemoteMuted(false);
    setLocalVolume(0);
    setRemoteVolume(0);
  }, []);

  // ── Get media (camera/mic) ────────────────────────────────────────────────
  const getMedia = useCallback(async (type: CallType): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: type === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn("getUserMedia failed, using silent fallback:", err);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const dst = audioCtx.createMediaStreamDestination();
      osc.connect(dst);
      osc.start();
      const fallback = new MediaStream([dst.stream.getAudioTracks()[0]]);
      localStreamRef.current = fallback;
      setLocalStream(fallback);
      return fallback;
    }
  }, []);

  // ── Peer connection factory ────────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (targetUserId: string, conversationId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Remote tracks → remoteStream state
      const remoteMediaStream = new MediaStream();
      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          // Avoid adding duplicate tracks
          if (!remoteMediaStream.getTrackById(track.id)) {
            remoteMediaStream.addTrack(track);
          }
        });
        // Update state reference so React re-renders
        setRemoteStream(new MediaStream(remoteMediaStream.getTracks()));
      };

      // ICE candidate → relay via signaling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          emit("call:ice-candidate", {
            targetUserId,
            candidate: event.candidate,
            conversationId,
          });
        }
      };

      // Connection state machine
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

      // ICE connection fallback
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          pc.restartIce?.();
        }
      };

      return pc;
    },
    [emit, cleanupMedia]
  );

  // ── 1. Start outgoing call ────────────────────────────────────────────────
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

        emit("call:initiate", { recipientId, conversationId, callType: type, offer });
      } catch (err) {
        console.error("startCall failed:", err);
        cleanupMedia();
      }
    },
    [cleanupMedia, getMedia, createPeerConnection, emit]
  );

  // ── 2. Accept incoming call ───────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!partner || !activeConversationId || !incomingOfferRef.current) return;

    try {
      const stream = await getMedia(callType);
      const pc = createPeerConnection(partner.id, activeConversationId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Caller will set state to "connected" via onconnectionstatechange
      // Callee sets it early so the UI switches immediately
      setCallState("connected");

      emit("call:accept", {
        callerId: partner.id,
        conversationId: activeConversationId,
        answer,
      });
    } catch (err) {
      console.error("acceptCall failed:", err);
      cleanupMedia();
    }
  }, [partner, activeConversationId, callType, getMedia, createPeerConnection, emit, cleanupMedia]);

  // ── 3. Reject incoming call ───────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (partner && activeConversationId) {
      emit("call:reject", { callerId: partner.id, conversationId: activeConversationId });
    }
    cleanupMedia();
  }, [partner, activeConversationId, emit, cleanupMedia]);

  // ── 4. End active call ────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    if (partner && activeConversationId) {
      emit("call:end", { targetUserId: partner.id, conversationId: activeConversationId });
    }
    cleanupMedia();
  }, [partner, activeConversationId, emit, cleanupMedia]);

  // ── 5. Toggle mic ─────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMicMuted(!track.enabled);
    }
  }, []);

  // ── 6. Toggle camera ──────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsCameraOff(!track.enabled);
    }
  }, []);

  // ── 7. Start screen share ─────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    if (!pcRef.current) return;
    try {
      const screen = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });
      const screenTrack = screen.getVideoTracks()[0];
      screenStreamRef.current = screen;
      setScreenStream(screen);
      setIsScreenSharing(true);

      // Replace the camera video sender with the screen track
      const sender = pcRef.current
        .getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(screenTrack);
        screenSenderRef.current = sender;
      }

      // When user stops sharing via browser's native stop button
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.warn("Screen share failed or cancelled:", err);
    }
  }, []);

  // ── 8. Stop screen share ──────────────────────────────────────────────────
  const stopScreenShare = useCallback(async () => {
    if (!pcRef.current || !screenSenderRef.current) return;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);

    // Restore original camera track
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack && screenSenderRef.current) {
      await screenSenderRef.current.replaceTrack(cameraTrack);
    }
    screenSenderRef.current = null;
  }, []);

  // ── 9. Socket signaling events ────────────────────────────────────────────
  useEffect(() => {
    const unsubIncoming = subscribe("call:incoming", (data: IncomingCallPayload) => {
      if (callStateRef.current !== "idle") {
        emit("call:reject", { callerId: data.callerId, conversationId: data.conversationId });
        return;
      }
      setCallType(data.callType);
      setPartner({ id: data.callerId, name: data.callerName });
      setActiveConversationId(data.conversationId);
      incomingOfferRef.current = data.offer;
      setCallState("incoming");
    });

    const unsubAccepted = subscribe("call:accepted", async (data: CallAcceptedPayload) => {
      if (pcRef.current && data.answer) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          // onconnectionstatechange will fire "connected" shortly after
        } catch (err) {
          console.error("setRemoteDescription failed:", err);
        }
      }
    });

    const unsubRejected = subscribe("call:rejected", () => cleanupMedia());
    const unsubEnded    = subscribe("call:ended",    () => cleanupMedia());

    const unsubIce = subscribe("call:ice-candidate", async (data: CallIceCandidatePayload) => {
      if (pcRef.current && data.candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error("addIceCandidate failed:", err);
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
        isScreenSharing,
        isRemoteMuted,
        localStream,
        remoteStream,
        screenStream,
        localVolume,
        remoteVolume,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMic,
        toggleCamera,
        startScreenShare,
        stopScreenShare,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

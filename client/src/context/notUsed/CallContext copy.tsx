/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/preserve-manual-memoization */
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
  onVolume: (v: number) => void,
): () => void {
  let rafId = 0;
  let audioCtx: AudioContext | null = null;

  try {
    audioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
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
  isRemoteMuted: boolean; // true when remote has no active video tracks
  isRemoteAudioMuted: boolean; // true when remote audio track is muted/disabled
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenStream: MediaStream | null;
  /** 0.0–1.0 local mic volume (60fps) */
  localVolume: number;
  /** 0.0–1.0 remote audio volume (60fps) */
  remoteVolume: number;
  /** Currently active audio input device ID */
  activeAudioInputId: string | null;
  /** Currently active audio output device ID */
  activeAudioOutputId: string | null;
  /** Currently active video input device ID */
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
  toggleCamera: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  /** Switch to a different microphone */
  switchAudioInput: (deviceId: string) => Promise<void>;
  /** Switch audio output (speaker) — uses setSinkId where supported */
  switchAudioOutput: (deviceId: string) => Promise<void>;
  /** Switch to a different camera */
  switchCamera: (deviceId: string) => Promise<void>;
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
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const [localVolume, setLocalVolume] = useState(0);
  const [remoteVolume, setRemoteVolume] = useState(0);

  // Active device IDs
  const [activeAudioInputId, setActiveAudioInputId] = useState<string | null>(null);
  const [activeAudioOutputId, setActiveAudioOutputId] = useState<string | null>(null);
  const [activeVideoInputId, setActiveVideoInputId] = useState<string | null>(null);

  // Ref to the remote audio element for setSinkId
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);

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
  // Stable refs to partner/conversationId — always current, safe in callbacks
  const partnerRef = useRef<{ id: string; name: string } | null>(null);
  const activeConvIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { partnerRef.current = partner; }, [partner]);
  useEffect(() => { activeConvIdRef.current = activeConversationId; }, [activeConversationId]);

  // ── Volume analysers ──────────────────────────────────────────────────────

  // Local volume: run whenever we have a local stream (even during "outgoing"
  // so the caller sees their own voice rings immediately)
  useEffect(() => {
    localVolCleanupRef.current?.();
    localVolCleanupRef.current = null;

    if (localStream) {
      // Slight delay so AudioContext isn't created before user gesture
      const t = setTimeout(() => {
        localVolCleanupRef.current = createVolumeAnalyser(
          localStream,
          setLocalVolume,
        );
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
        remoteVolCleanupRef.current = createVolumeAnalyser(
          remoteStream,
          setRemoteVolume,
        );
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
    if (!remoteStream) {
      setIsRemoteMuted(false);
      return;
    }
    const check = () => {
      const videoTracks = remoteStream.getVideoTracks();
      const hasActiveVideo = videoTracks.some(
        (t) => t.enabled && t.readyState === "live",
      );
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

  // Detect whether remote audio is muted
  useEffect(() => {
    if (!remoteStream) {
      setIsRemoteAudioMuted(false);
      return;
    }
    const checkAudio = () => {
      const audioTracks = remoteStream.getAudioTracks();
      // No audio tracks OR all disabled/ended → muted
      const hasActiveAudio = audioTracks.some(
        (t) => t.enabled && t.readyState === "live",
      );
      setIsRemoteAudioMuted(!hasActiveAudio);
    };
    checkAudio();
    remoteStream.getAudioTracks().forEach((t) => {
      t.addEventListener("mute", checkAudio);
      t.addEventListener("unmute", checkAudio);
      t.addEventListener("ended", checkAudio);
    });
    return () => {
      remoteStream.getAudioTracks().forEach((t) => {
        t.removeEventListener("mute", checkAudio);
        t.removeEventListener("unmute", checkAudio);
        t.removeEventListener("ended", checkAudio);
      });
    };
  }, [remoteStream]);

  // ── Call duration counter ─────────────────────────────────────────────────
  useEffect(() => {
    if (callState === "connected") {
      setCallDuration(0);
      durationTimerRef.current = setInterval(
        () => setCallDuration((p) => p + 1),
        1000,
      );
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
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
    setIsRemoteAudioMuted(false);
    setLocalVolume(0);
    setRemoteVolume(0);
  }, []);

  // ── Get media (camera/mic) ────────────────────────────────────────────────
  const getMedia = useCallback(async (type: CallType): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        type === "video"
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            }
          : false,
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn("getUserMedia failed, using silent fallback:", err);
      const audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
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
    [emit, cleanupMedia],
  );

  // ── 1. Start outgoing call ────────────────────────────────────────────────
  const startCall = useCallback(
    async (
      recipientId: string,
      recipientName: string,
      conversationId: string,
      type: CallType,
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
        console.error("startCall failed:", err);
        cleanupMedia();
      }
    },
    [cleanupMedia, getMedia, createPeerConnection, emit],
  );

  // ── 2. Accept incoming call ───────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!partner || !activeConversationId || !incomingOfferRef.current) return;

    try {
      const stream = await getMedia(callType);
      const pc = createPeerConnection(partner.id, activeConversationId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingOfferRef.current),
      );
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
  }, [
    partner,
    activeConversationId,
    callType,
    getMedia,
    createPeerConnection,
    emit,
    cleanupMedia,
  ]);

  // ── 3. Reject incoming call ───────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (partner && activeConversationId) {
      emit("call:reject", {
        callerId: partner.id,
        conversationId: activeConversationId,
      });
    }
    cleanupMedia();
  }, [partner, activeConversationId, emit, cleanupMedia]);

  // ── 4. End active call ────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    if (partner && activeConversationId) {
      emit("call:end", {
        targetUserId: partner.id,
        conversationId: activeConversationId,
      });
    }
    cleanupMedia();
  }, [partner, activeConversationId, emit, cleanupMedia]);

  // ── 5. Toggle mic ─────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const muted = !track.enabled;
    setIsMicMuted(muted);
    // Signal media state to remote peer
    const p = partnerRef.current;
    const cid = activeConvIdRef.current;
    if (p && cid) {
      // isCameraOff is not tracked here — peek at current video track
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      const cameraOff = videoTrack ? !videoTrack.enabled : true;
      emit("call:media-state", {
        targetUserId: p.id,
        conversationId: cid,
        isMicMuted: muted,
        isCameraOff: cameraOff,
      });
    }
  }, [emit]);

  // ── 6. Toggle camera ──────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current;

    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];

    // CAMERA OFF
    if (videoTrack && videoTrack.enabled) {
      videoTrack.enabled = false;
      setIsCameraOff(true);

      const sender = pcRef.current
        ?.getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(videoTrack);

      // Signal camera off to remote peer
      const p = partnerRef.current;
      const cid = activeConvIdRef.current;
      if (p && cid) {
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        emit("call:media-state", {
          targetUserId: p.id,
          conversationId: cid,
          isMicMuted: audioTrack ? !audioTrack.enabled : false,
          isCameraOff: true,
        });
      }
      return;
    }

    // CAMERA ON (existing track)
    if (videoTrack) {
      videoTrack.enabled = true;
      const sender = pcRef.current
        ?.getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(videoTrack);

      setLocalStream(new MediaStream(stream.getTracks()));
      setIsCameraOff(false);

      // Signal camera on to remote peer
      const p = partnerRef.current;
      const cid = activeConvIdRef.current;
      if (p && cid) {
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        emit("call:media-state", {
          targetUserId: p.id,
          conversationId: cid,
          isMicMuted: audioTrack ? !audioTrack.enabled : false,
          isCameraOff: false,
        });
      }
      return;
    }

    // Track was removed/stopped — request camera again
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      const newTrack = cameraStream.getVideoTracks()[0];
      stream.addTrack(newTrack);
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      else if (pcRef.current) pcRef.current.addTrack(newTrack, stream);
      localStreamRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));
      setIsCameraOff(false);
    } catch (err) {
      console.error("Failed to enable camera:", err);
      return;
    }

    // Signal camera on to remote peer
    const p = partnerRef.current;
    const cid = activeConvIdRef.current;
    if (p && cid) {
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];
      emit("call:media-state", {
        targetUserId: p.id,
        conversationId: cid,
        isMicMuted: audioTrack ? !audioTrack.enabled : false,
        isCameraOff: false,
      });
    }
  }, [emit]);

  // ── 7. Switch audio input (microphone) ──────────────────────────────────
  const switchAudioInput = useCallback(async (deviceId: string) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const newTrack = newStream.getAudioTracks()[0];
      // Replace old audio track in the stream
      stream.getAudioTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
      stream.addTrack(newTrack);
      // Replace in peer connection
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) await sender.replaceTrack(newTrack);
      localStreamRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));
      setActiveAudioInputId(deviceId);
    } catch (err) {
      console.error("switchAudioInput failed:", err);
    }
  }, []);

  // ── 8. Switch audio output (speaker) ──────────────────────────────────────
  const switchAudioOutput = useCallback(async (deviceId: string) => {
    setActiveAudioOutputId(deviceId);
    // Apply to the remote audio element if available
    const el = remoteAudioElRef.current;
    if (el && typeof (el as any).setSinkId === "function") {
      try {
        await (el as any).setSinkId(deviceId);
      } catch (err) {
        console.warn("setSinkId failed:", err);
      }
    }
  }, []);

  // ── 9. Switch camera ──────────────────────────────────────────────────────
  const switchCamera = useCallback(async (deviceId: string) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      // Replace old video track
      stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
      stream.addTrack(newTrack);
      // Replace in peer connection
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      localStreamRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));
      setActiveVideoInputId(deviceId);
      setIsCameraOff(false);
    } catch (err) {
      console.error("switchCamera failed:", err);
    }
  }, []);

  // ── 10. Start screen share ─────────────────────────────────────────────────
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
    const unsubIncoming = subscribe(
      "call:incoming",
      (data: IncomingCallPayload) => {
        if (callStateRef.current !== "idle") {
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
      },
    );

    const unsubAccepted = subscribe(
      "call:accepted",
      async (data: CallAcceptedPayload) => {
        if (pcRef.current && data.answer) {
          try {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription(data.answer),
            );
            // onconnectionstatechange will fire "connected" shortly after
          } catch (err) {
            console.error("setRemoteDescription failed:", err);
          }
        }
      },
    );

    const unsubRejected = subscribe("call:rejected", () => cleanupMedia());
    const unsubEnded = subscribe("call:ended", () => cleanupMedia());

    const unsubIce = subscribe(
      "call:ice-candidate",
      async (data: CallIceCandidatePayload) => {
        if (pcRef.current && data.candidate) {
          try {
            await pcRef.current.addIceCandidate(
              new RTCIceCandidate(data.candidate),
            );
          } catch (err) {
            console.error("addIceCandidate failed:", err);
          }
        }
      },
    );

    // call:media-state — reliable mic/camera state from the remote peer
    const unsubMediaState = subscribe(
      "call:media-state",
      (data: { senderId: string; isMicMuted: boolean; isCameraOff: boolean }) => {
        // isRemoteMuted = camera off, isRemoteAudioMuted = mic muted
        setIsRemoteMuted(data.isCameraOff);
        setIsRemoteAudioMuted(data.isMicMuted);
      },
    );

    return () => {
      unsubIncoming();
      unsubAccepted();
      unsubRejected();
      unsubEnded();
      unsubIce();
      unsubMediaState();
    };
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

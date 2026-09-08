/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability */
"use client";

import { useCallback } from "react";
import type { EmitFn } from "./types";
import type { CallRefs } from "./useCallRefs";

// Helper: emit the current local mic/camera state to the remote peer
function emitMediaState(
  emit: EmitFn,
  refs: Pick<CallRefs, "localStreamRef" | "partnerRef" | "activeConvIdRef">,
  overrides: Partial<{ isMicMuted: boolean; isCameraOff: boolean }> = {},
) {
  const p = refs.partnerRef.current;
  const cid = refs.activeConvIdRef.current;
  if (!p || !cid) return;

  const audioTrack = refs.localStreamRef.current?.getAudioTracks()[0];
  const videoTrack = refs.localStreamRef.current?.getVideoTracks()[0];

  emit("call:media-state", {
    targetUserId: p.id,
    conversationId: cid,
    isMicMuted: overrides.isMicMuted   ?? (audioTrack ? !audioTrack.enabled : false),
    isCameraOff: overrides.isCameraOff ?? (videoTrack ? !videoTrack.enabled : true),
  });
}

interface UseMediaControlsOptions {
  refs: Pick<CallRefs, "localStreamRef" | "screenStreamRef" | "screenSenderRef" | "pcRef" | "partnerRef" | "activeConvIdRef" | "remoteAudioElRef">;
  emit: EmitFn;
  setLocalStream: (s: MediaStream | null) => void;
  setScreenStream: (s: MediaStream | null) => void;
  setIsMicMuted: (v: boolean) => void;
  setIsCameraOff: (v: boolean) => void;
  setIsScreenSharing: (v: boolean) => void;
  setActiveAudioInputId: (id: string | null) => void;
  setActiveAudioOutputId: (id: string | null) => void;
  setActiveVideoInputId: (id: string | null) => void;
  stopScreenShareFn: () => Promise<void>;
}

/**
 * All mic/camera/speaker/screen controls in one hook.
 * Each function is a stable useCallback — safe to pass as props.
 */
export function useMediaControls({
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
  stopScreenShareFn,
}: UseMediaControlsOptions) {

  // ── Toggle microphone ─────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const track = refs.localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const muted = !track.enabled;
    setIsMicMuted(muted);
    emitMediaState(emit, refs, { isMicMuted: muted });
  }, [emit, refs, setIsMicMuted]);

  // ── Toggle camera ─────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const stream = refs.localStreamRef.current;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    const videoSender = () =>
      refs.pcRef.current?.getSenders().find((s) => s.track?.kind === "video");

    // CAMERA OFF
    if (videoTrack?.enabled) {
      videoTrack.enabled = false;
      setIsCameraOff(true);
      const sender = videoSender();
      if (sender) await sender.replaceTrack(videoTrack);
      emitMediaState(emit, refs, { isCameraOff: true });
      return;
    }

    // CAMERA ON — re-enable existing track
    if (videoTrack) {
      videoTrack.enabled = true;
      const sender = videoSender();
      if (sender) await sender.replaceTrack(videoTrack);
      setLocalStream(new MediaStream(stream.getTracks()));
      setIsCameraOff(false);
      emitMediaState(emit, refs, { isCameraOff: false });
      return;
    }

    // CAMERA ON — track was stopped; request fresh stream
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      const newTrack = newStream.getVideoTracks()[0];
      stream.addTrack(newTrack);
      const sender = videoSender();
      if (sender) await sender.replaceTrack(newTrack);
      else if (refs.pcRef.current) refs.pcRef.current.addTrack(newTrack, stream);
      refs.localStreamRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));
      setIsCameraOff(false);
      emitMediaState(emit, refs, { isCameraOff: false });
    } catch (err) {
      console.error("Failed to enable camera:", err);
    }
  }, [emit, refs, setLocalStream, setIsCameraOff]);

  // ── Switch microphone ─────────────────────────────────────────────────────
  const switchAudioInput = useCallback(async (deviceId: string) => {
    const stream = refs.localStreamRef.current;
    if (!stream) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const newTrack = newStream.getAudioTracks()[0];
      stream.getAudioTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
      stream.addTrack(newTrack);
      const sender = refs.pcRef.current?.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) await sender.replaceTrack(newTrack);
      refs.localStreamRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));
      setActiveAudioInputId(deviceId);
    } catch (err) {
      console.error("switchAudioInput failed:", err);
    }
  }, [refs, setLocalStream, setActiveAudioInputId]);

  // ── Switch speaker output ─────────────────────────────────────────────────
  const switchAudioOutput = useCallback(async (deviceId: string) => {
    setActiveAudioOutputId(deviceId);
    const el = refs.remoteAudioElRef.current;
    if (el && typeof (el as any).setSinkId === "function") {
      try { await (el as any).setSinkId(deviceId); }
      catch (err) { console.warn("setSinkId failed:", err); }
    }
  }, [refs.remoteAudioElRef, setActiveAudioOutputId]);

  // ── Switch camera device ──────────────────────────────────────────────────
  const switchCamera = useCallback(async (deviceId: string) => {
    const stream = refs.localStreamRef.current;
    if (!stream) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
      stream.addTrack(newTrack);
      const sender = refs.pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      refs.localStreamRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));
      setActiveVideoInputId(deviceId);
      setIsCameraOff(false);
    } catch (err) {
      console.error("switchCamera failed:", err);
    }
  }, [refs, setLocalStream, setActiveVideoInputId, setIsCameraOff]);

  // ── Screen share ──────────────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    if (!refs.pcRef.current) return;
    try {
      const screen = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });
      const screenTrack: MediaStreamTrack = screen.getVideoTracks()[0];
      refs.screenStreamRef.current = screen;
      setScreenStream(screen);
      setIsScreenSharing(true);

      const sender = refs.pcRef.current
        .getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(screenTrack);
        refs.screenSenderRef.current = sender;
      }
      screenTrack.onended = () => stopScreenShareFn();
    } catch (err) {
      console.warn("Screen share failed or cancelled:", err);
    }
  }, [refs, setScreenStream, setIsScreenSharing, stopScreenShareFn]);

  const stopScreenShare = useCallback(async () => {
    if (!refs.pcRef.current || !refs.screenSenderRef.current) return;
    refs.screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    refs.screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);

    const cameraTrack = refs.localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack && refs.screenSenderRef.current) {
      await refs.screenSenderRef.current.replaceTrack(cameraTrack);
    }
    refs.screenSenderRef.current = null;
  }, [refs, setScreenStream, setIsScreenSharing]);

  return {
    toggleMic,
    toggleCamera,
    switchAudioInput,
    switchAudioOutput,
    switchCamera,
    startScreenShare,
    stopScreenShare,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect } from "react";
import type {
  CallAcceptedPayload,
  CallIceCandidatePayload,
  IncomingCallPayload,
} from "@/types/socket.client";
import type { EmitFn } from "./types";
import type { CallRefs } from "./useCallRefs";

interface UseCallSignalingOptions {
  refs: Pick<CallRefs, "pcRef" | "incomingOfferRef" | "callStateRef">;
  subscribe: (event: string, handler: (data: any) => void) => () => void;
  emit: EmitFn;
  cleanupMedia: () => void;
  setCallType: (t: any) => void;
  setPartner: (p: any) => void;
  setActiveConversationId: (id: string | null) => void;
  setCallState: (s: any) => void;
  setIsRemoteMuted: (v: boolean) => void;
  setIsRemoteAudioMuted: (v: boolean) => void;
}

/**
 * Registers and tears down all call-related WebSocket event listeners:
 *  - call:incoming   — shows the incoming call UI
 *  - call:accepted   — sets remote SDP answer on the caller side
 *  - call:rejected   — cleans up
 *  - call:ended      — cleans up
 *  - call:ice-candidate — adds ICE candidates to the peer connection
 *  - call:media-state  — authoritative mic/camera mute state from remote peer
 */
export function useCallSignaling({
  refs,
  subscribe,
  emit,
  cleanupMedia,
  setCallType,
  setPartner,
  setActiveConversationId,
  setCallState,
  setIsRemoteMuted,
  setIsRemoteAudioMuted,
}: UseCallSignalingOptions) {
  useEffect(() => {
    // ── Incoming call ───────────────────────────────────────────────────────
    const unsubIncoming = subscribe(
      "call:incoming",
      (data: IncomingCallPayload) => {
        if (refs.callStateRef.current !== "idle") {
          // Already in a call — auto-reject the new one
          emit("call:reject", { callerId: data.callerId, conversationId: data.conversationId });
          return;
        }
        setCallType(data.callType);
        setPartner({ id: data.callerId, name: data.callerName });
        setActiveConversationId(data.conversationId);
        refs.incomingOfferRef.current = data.offer;
        setCallState("incoming");
      },
    );

    // ── Caller receives answer ──────────────────────────────────────────────
    const unsubAccepted = subscribe(
      "call:accepted",
      async (data: CallAcceptedPayload) => {
        if (refs.pcRef.current && data.answer) {
          try {
            await refs.pcRef.current.setRemoteDescription(
              new RTCSessionDescription(data.answer),
            );
          } catch (err) {
            console.error("setRemoteDescription failed:", err);
          }
        }
      },
    );

    // ── Call rejected / ended ───────────────────────────────────────────────
    const unsubRejected = subscribe("call:rejected", cleanupMedia);
    const unsubEnded    = subscribe("call:ended",    cleanupMedia);

    // ── ICE candidates ──────────────────────────────────────────────────────
    const unsubIce = subscribe(
      "call:ice-candidate",
      async (data: CallIceCandidatePayload) => {
        if (refs.pcRef.current && data.candidate) {
          try {
            await refs.pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.error("addIceCandidate failed:", err);
          }
        }
      },
    );

    // ── Media state signal (authoritative source for remote mute icons) ─────
    const unsubMediaState = subscribe(
      "call:media-state",
      (data: { isMicMuted: boolean; isCameraOff: boolean }) => {
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
  }, [
    refs,
    subscribe,
    emit,
    cleanupMedia,
    setCallType,
    setPartner,
    setActiveConversationId,
    setCallState,
    setIsRemoteMuted,
    setIsRemoteAudioMuted,
  ]);
}

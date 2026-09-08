/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback } from "react";
import type { CallType } from "./types";
import type { EmitFn } from "./types";
import type { CallRefs } from "./useCallRefs";

interface UseCallActionsOptions {
  refs: Pick<CallRefs, "incomingOfferRef">;
  emit: EmitFn;
  partner: { id: string; name: string } | null;
  activeConversationId: string | null;
  callType: CallType;
  cleanupMedia: () => void;
  getMedia: (type: CallType) => Promise<MediaStream>;
  createPeerConnection: (targetUserId: string, conversationId: string) => RTCPeerConnection;
  setCallType: (t: CallType) => void;
  setPartner: (p: { id: string; name: string } | null) => void;
  setActiveConversationId: (id: string | null) => void;
  setCallState: (s: any) => void;
}

/**
 * High-level call lifecycle actions:
 *  - startCall   — initiate outgoing call
 *  - acceptCall  — answer an incoming call
 *  - rejectCall  — decline an incoming call
 *  - endCall     — terminate an active call
 */
export function useCallActions({
  refs,
  emit,
  partner,
  activeConversationId,
  callType,
  cleanupMedia,
  getMedia,
  createPeerConnection,
  setCallType,
  setPartner,
  setActiveConversationId,
  setCallState,
}: UseCallActionsOptions) {

  // ── Start outgoing call ───────────────────────────────────────────────────
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

        emit("call:initiate", { recipientId, conversationId, callType: type, offer });
      } catch (err) {
        console.error("startCall failed:", err);
        cleanupMedia();
      }
    },
    [cleanupMedia, getMedia, createPeerConnection, emit, setCallType, setPartner, setActiveConversationId, setCallState],
  );

  // ── Accept incoming call ──────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!partner || !activeConversationId || !refs.incomingOfferRef.current) return;

    try {
      const stream = await getMedia(callType);
      const pc = createPeerConnection(partner.id, activeConversationId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(refs.incomingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Callee sets connected early; caller sets it via onconnectionstatechange
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
  }, [partner, activeConversationId, callType, refs.incomingOfferRef, getMedia, createPeerConnection, emit, setCallState, cleanupMedia]);

  // ── Reject incoming call ──────────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (partner && activeConversationId) {
      emit("call:reject", { callerId: partner.id, conversationId: activeConversationId });
    }
    cleanupMedia();
  }, [partner, activeConversationId, emit, cleanupMedia]);

  // ── End active call ───────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    if (partner && activeConversationId) {
      emit("call:end", { targetUserId: partner.id, conversationId: activeConversationId });
    }
    cleanupMedia();
  }, [partner, activeConversationId, emit, cleanupMedia]);

  return { startCall, acceptCall, rejectCall, endCall };
}

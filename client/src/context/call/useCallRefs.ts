"use client";

import { useRef } from "react";
import type { CallState } from "./types";
import type { CallParticipant } from "./context";

/**
 * All mutable refs that must be shared across every call hook.
 * Using refs (not state) keeps them stable across re-renders and safe
 * to read inside useCallback / setTimeout without stale-closure issues.
 */
export function useCallRefs() {
  /** The live RTCPeerConnection */
  const pcRef = useRef<RTCPeerConnection | null>(null);

  /** The pending SDP offer from the remote side (incoming call) */
  const incomingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  /** The active local camera/mic stream */
  const localStreamRef = useRef<MediaStream | null>(null);

  /** The active screen-share stream */
  const screenStreamRef = useRef<MediaStream | null>(null);

  /** The RTCRtpSender that is currently carrying the video track */
  const screenSenderRef = useRef<RTCRtpSender | null>(null);

  /** Duration interval handle */
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  /** Cleanup fn for the local volume analyser */
  const localVolCleanupRef = useRef<(() => void) | null>(null);

  /** Cleanup fn for the remote volume analyser */
  const remoteVolCleanupRef = useRef<(() => void) | null>(null);

  /** Mirror of `callState` — always current, safe inside stable callbacks */
  const callStateRef = useRef<CallState>("idle");

  /** Mirror of `partner` — always current, safe inside stable callbacks */
  const partnerRef = useRef<CallParticipant | null>(null);

  /** Mirror of `activeConversationId` — always current */
  const activeConvIdRef = useRef<string | null>(null);

  /** Ref to the remote <audio> element (for setSinkId) */
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);

  return {
    pcRef,
    incomingOfferRef,
    localStreamRef,
    screenStreamRef,
    screenSenderRef,
    durationTimerRef,
    localVolCleanupRef,
    remoteVolCleanupRef,
    callStateRef,
    partnerRef,
    activeConvIdRef,
    remoteAudioElRef,
  };
}

export type CallRefs = ReturnType<typeof useCallRefs>;

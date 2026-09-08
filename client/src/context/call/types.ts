"use client";

import type { ClientToServerEvents } from "@/types/socket.client";

/** Typed emit from SocketContext */
export type EmitFn = <K extends keyof ClientToServerEvents>(type: K, payload: ClientToServerEvents[K]) => void;

/**
 * Shared call-related types.
 * Kept minimal so it can be imported by both context.ts and hook files
 * without circular dependencies.
 */

export type CallState = "idle" | "outgoing" | "incoming" | "connected";
export type CallType = "audio" | "video";

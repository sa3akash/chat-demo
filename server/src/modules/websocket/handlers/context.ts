/**
 * Shared context passed into every WebSocket message handler.
 * Mirrors what Elysia exposes inside ws.message().
 */
export interface WsContext {
  /** The raw Elysia/uWS WebSocket instance */
  ws: {
    send: (data: string) => void;
    subscribe: (topic: string) => void;
    unsubscribe: (topic: string) => void;
  };
  /** Authenticated user id (from JWT) */
  senderId: string;
  /** Authenticated username (from JWT) */
  username: string;
}

/** Typed helper to push a frame back to the sender */
export function sendFrame(
  ws: WsContext["ws"],
  type: string,
  payload: unknown
): void {
  ws.send(JSON.stringify({ type, payload }));
}

/** Send a standardised error frame */
export function sendError(
  ws: WsContext["ws"],
  code: string,
  message: string
): void {
  sendFrame(ws, "error", { code, message });
}

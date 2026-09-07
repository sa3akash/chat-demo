"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/context/AuthContext";
import { SocketProvider } from "@/lib/context/SocketContext";

/**
 * Composition root. AuthProvider must wrap SocketProvider since the socket
 * connection depends on the auth token. Anything under here can freely use
 * useAuth() / useSocket() / the feature hooks without prop-drilling.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SocketProvider>{children}</SocketProvider>
    </AuthProvider>
  );
}

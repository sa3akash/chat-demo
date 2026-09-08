"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { CallProvider } from "@/context/CallContext";
import { CallOverlay } from "@/components/chat/CallOverlay";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "@/components/ui/toast";

const AppProviders = ({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) => {
  return (
    <NextThemesProvider {...props}>
      <TooltipProvider>
        <AuthProvider>
          <SocketProvider>
            <CallProvider>
              {children}
              <CallOverlay />
              <Toaster />
            </CallProvider>
          </SocketProvider>
        </AuthProvider>
      </TooltipProvider>
    </NextThemesProvider>
  );
};

export default AppProviders;

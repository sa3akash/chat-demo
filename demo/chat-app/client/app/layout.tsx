import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Chat", description: "Realtime chat app" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}

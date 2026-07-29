"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { RegisterSW } from "@/components/pwa/RegisterSW";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <ToastProvider>
        {children}
        <RegisterSW />
        <PwaInstallPrompt />
      </ToastProvider>
    </NextAuthSessionProvider>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, MoreVertical, Share, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pwa-install-dismissed-at";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function isAppleMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isAndroidDevice() {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [isIos] = useState(isAppleMobileDevice);
  const [isAndroid] = useState(isAndroidDevice);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (isStandalone) return;

    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
    const recentlyDismissed = Date.now() - dismissedAt < DISMISS_FOR_MS;
    const ios = isAppleMobileDevice();
    const android = isAndroidDevice();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (!recentlyDismissed) setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      window.localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    let mobileTimer: number | undefined;
    if ((ios || android) && !recentlyDismissed) {
      mobileTimer = window.setTimeout(() => setVisible(true), 1800);
    }

    return () => {
      if (mobileTimer) window.clearTimeout(mobileTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.aside
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-x-3 z-[1200] max-w-sm sm:left-4 sm:right-auto"
          style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          aria-label="Install PalletTrack Pro"
        >
          <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 text-slate-900 shadow-[0_12px_36px_rgba(15,23,42,0.2)] backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                <Smartphone size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Install PalletTrack Pro</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {isIos
                    ? "Tap Share, then choose Add to Home Screen."
                    : isAndroid && !deferredPrompt
                      ? "Open the Chrome menu, then choose Install app or Add to Home screen."
                      : "Install the app for faster, full-screen access."}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {deferredPrompt ? (
                    <button
                      type="button"
                      onClick={install}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500"
                    >
                      <Download size={14} /> Install app
                    </button>
                  ) : (
                    <span className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                      {isIos ? <Share size={14} /> : <MoreVertical size={14} />}
                      {isIos ? "Share menu" : "Chrome menu"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={dismiss}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                  >
                    Not now
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
                aria-label="Dismiss install reminder"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

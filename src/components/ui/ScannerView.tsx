"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/Button";
import {
  Camera,
  Keyboard,
  ScanLine,
  X,
  Zap,
  ZapOff,
} from "lucide-react";

interface ScannerViewProps {
  onScan: (code: string) => void;
  onManualEnter?: (code: string) => void;
  disabled?: boolean;
  accent?: "field" | "dispatch" | "admin";
  label?: string;
  placeholder?: string;
}

const accentStyles = {
  field: {
    ring: "ring-orange-300",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-300",
    btn: "field" as const,
    frame: "border-orange-400",
    glow: "shadow-orange-500/30",
  },
  dispatch: {
    ring: "ring-violet-300",
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-300",
    btn: "dispatch" as const,
    frame: "border-violet-400",
    glow: "shadow-violet-500/30",
  },
  admin: {
    ring: "ring-teal-300",
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-300",
    btn: "primary" as const,
    frame: "border-teal-400",
    glow: "shadow-teal-500/30",
  },
};

export function ScannerView({
  onScan,
  onManualEnter,
  disabled = false,
  accent = "field",
  label = "Scan QR code",
  placeholder = "PT-…",
}: ScannerViewProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const styles = accentStyles[accent];

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore cleanup errors
      }
      scannerRef.current = null;
      setCameraReady(false);
      setScanning(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!containerRef.current || scannerRef.current) return;

    try {
      setCameraError(null);
      setScanning(true);

      const scanner = new Html5Qrcode("qr-scanner-region");
      scannerRef.current = scanner;

      const scanBoxSize = Math.min(250, Math.max(180, containerRef.current.clientWidth - 32));

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: scanBoxSize, height: scanBoxSize },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (disabled) return;
          setLastScan(decodedText);
          onScan(decodedText);
          // Brief pause after successful scan to prevent rapid re-scans
          setScanning(false);
          setTimeout(() => setScanning(true), 1500);
        },
        () => {
          // ignore scan failures (no QR found in frame)
        }
      );

      setCameraReady(true);
      setScanning(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Camera access denied";
      setCameraError(msg);
      setScanning(false);
      // Fallback to manual mode if camera fails
      setMode("manual");
    }
  }, [disabled, onScan]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (mode === "camera") {
        void startCamera();
      } else {
        void stopCamera();
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      void stopCamera();
    };
  }, [mode, startCamera, stopCamera]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !cameraReady) return;
    try {
      const track = (
        scannerRef.current as unknown as {
          getRunningTrackSettings?: () => Record<string, unknown>;
        }
      ).getRunningTrackSettings?.();
      if (track?.torch !== undefined) {
        await (
          scannerRef.current as unknown as {
            applyVideoConstraints?: (constraints: Record<string, unknown>) => Promise<void>;
          }
        ).applyVideoConstraints?.({
          advanced: [{ torch: !torchOn } as Record<string, unknown>],
        });
        setTorchOn(!torchOn);
      }
    } catch {
      // Torch not supported
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim().length >= 3 && !disabled) {
      if (onManualEnter) {
        onManualEnter(manualCode.trim());
      } else {
        onScan(manualCode.trim());
      }
      setManualCode("");
    }
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("camera")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
            mode === "camera"
              ? `${styles.bg} ${styles.text} ring-1 ${styles.ring}`
              : "bg-white text-ink ring-1 ring-line hover:bg-surface"
          }`}
        >
          <Camera size={16} />
          Camera
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
            mode === "manual"
              ? `${styles.bg} ${styles.text} ring-1 ${styles.ring}`
              : "bg-white text-ink ring-1 ring-line hover:bg-surface"
          }`}
        >
          <Keyboard size={16} />
          Manual
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === "camera" ? (
          <motion.div
            key="camera"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* Camera viewport */}
            <div
              className={`relative overflow-hidden rounded-2xl bg-black ${styles.glow} shadow-lg`}
            >
              {/* Scanner region */}
              <div
                ref={containerRef}
                id="qr-scanner-region"
                className="aspect-square w-full"
              />

              {/* Overlay frame */}
              {scanning && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className={`h-[min(14rem,65vw)] w-[min(14rem,65vw)] rounded-3xl border-4 ${styles.frame} border-dashed opacity-80`}
                  />
                  <motion.div
                    className={`absolute h-1 w-[min(12rem,55vw)] rounded-full ${styles.frame.replace("border", "bg")}`}
                    animate={{
                      y: [-94, 94, -94],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              )}

              {/* Torch toggle */}
              {cameraReady && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                >
                  {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
                </button>
              )}

              {/* Close button */}
              <button
                type="button"
                onClick={() => setMode("manual")}
                className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
              >
                <X size={18} />
              </button>

              {/* Last scanned indicator */}
              <AnimatePresence>
                {lastScan && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/70 px-3 py-2 text-center text-xs font-bold text-white backdrop-blur-sm"
                  >
                    <ScanLine size={14} className="mr-1 inline" />
                    {lastScan}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Camera error */}
            {cameraError && (
              <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-100">
                Camera unavailable: {cameraError}. Switching to manual entry.
              </div>
            )}

            {/* Status */}
            {scanning && !cameraError && (
              <p className={`text-center text-xs font-semibold ${styles.text}`}>
                Point camera at QR code on pallet label
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="manual"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* Manual input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted">
                {label}
              </label>
              <input
                className="input-premium mono-code mt-1 text-sm"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                placeholder={placeholder}
                autoFocus
              />
            </div>
            <Button
              type="button"
              variant={styles.btn}
              fullWidth
              className="!min-h-[52px]"
              disabled={disabled || manualCode.trim().length < 3}
              onClick={handleManualSubmit}
            >
              <ScanLine size={18} />
              {onManualEnter ? "Enter code" : "Look up pallet"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

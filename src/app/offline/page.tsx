import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Offline - PalletTrack Pro",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-200 text-slate-600">
        <WifiOff size={28} />
      </div>
      <h1 className="font-display text-2xl font-bold text-navy-900">You are offline</h1>
      <p className="max-w-sm text-sm leading-6 text-slate-600">
        PalletTrack needs a network connection to scan pallets and save operational updates.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white"
      >
        <RefreshCw size={16} /> Try again
      </Link>
    </main>
  );
}

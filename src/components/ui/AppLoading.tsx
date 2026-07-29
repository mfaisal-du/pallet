import { Package } from "lucide-react";

export function AppLoading({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-[linear-gradient(165deg,#e8eef8_0%,#f3f6fb_55%,#f8fafc_100%)] px-6"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-blue-600 border-t-sky-400 motion-reduce:animate-none" />
          <div className="absolute inset-2 animate-pulse rounded-full bg-blue-100/80 ring-1 ring-blue-200 motion-reduce:animate-none" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-blue-700/25">
            <Package size={25} strokeWidth={2.2} />
          </div>
        </div>
        <p className="mt-4 font-display text-base font-bold text-navy-900">{label}</p>
        <p className="mt-1 text-xs font-medium text-slate-500">Please wait while we prepare your data.</p>
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-.3s] motion-reduce:animate-none" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-.15s] motion-reduce:animate-none" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

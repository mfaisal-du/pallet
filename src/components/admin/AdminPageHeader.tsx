"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Droplets,
  QrCode,
  Package,
  BarChart3,
  Truck,
} from "lucide-react";

const THEMES: Record<string, { icon: typeof Droplets; gradient: string; orb1: string; orb2: string }> = {
  lifecycle: { icon: Droplets, gradient: "from-cyan-600 via-blue-700 to-blue-900", orb1: "bg-cyan-400/25", orb2: "bg-blue-400/20" },
  "print shop": { icon: QrCode, gradient: "from-sky-600 via-blue-700 to-navy-900", orb1: "bg-sky-400/25", orb2: "bg-blue-400/20" },
  catalog: { icon: Package, gradient: "from-blue-600 via-indigo-700 to-navy-900", orb1: "bg-blue-400/25", orb2: "bg-indigo-400/20" },
  analytics: { icon: BarChart3, gradient: "from-emerald-600 via-teal-700 to-teal-900", orb1: "bg-emerald-400/25", orb2: "bg-teal-400/20" },
  logistics: { icon: Truck, gradient: "from-violet-600 via-purple-700 to-purple-900", orb1: "bg-violet-400/25", orb2: "bg-purple-400/20" },
};

export function AdminPageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: ReactNode;
}) {
  const theme = badge ? THEMES[badge] || THEMES.lifecycle : THEMES.lifecycle;
  const Icon = theme.icon;

  return (
    <div className={`relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br ${theme.gradient} p-5 text-white shadow-xl sm:p-6`}>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <motion.div
          className={`absolute -left-16 -top-16 h-52 w-52 rounded-full ${theme.orb1} blur-3xl`}
          animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={`absolute -right-16 bottom-0 h-40 w-40 rounded-full ${theme.orb2} blur-3xl`}
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle,white 1px,transparent 1px)", backgroundSize: "20px 20px" }} />
      </div>

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-100 backdrop-blur-md">
            <Icon size={12} />
            {badge || "Overview"}
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-sm text-blue-50/90">{subtitle}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

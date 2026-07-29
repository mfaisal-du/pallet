"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageReveal, StaggerList, StaggerItem } from "@/components/motion/PageReveal";
import {
  Activity,
  Package,
  Truck,
  RotateCcw,
  AlertTriangle,
  ArrowUpRight,
  QrCode,
  BarChart3,
} from "lucide-react";

type Kpis = {
  available: number;
  loaded: number;
  inTransit: number;
  delivered: number;
  returning: number;
  damaged: number;
  retired: number;
  total: number;
};

type EventRow = {
  id: string;
  action: string;
  createdAt: string;
  palletNumber: string;
  userName: string | null;
};

type PalletRow = {
  id: string;
  palletNumber: string;
  status: string;
  currentLocation: string | null;
};

export function AdminDashboardClient({
  userName,
  userCount,
  byRole,
  kpis,
  events,
  recentPallets,
}: {
  userName: string;
  userCount: number;
  byRole: { role: string; count: number }[];
  kpis: Kpis;
  events: EventRow[];
  recentPallets: PalletRow[];
}) {
  const first = userName.split(" ")[0] || "Admin";
  const [liveKpis, setLiveKpis] = useState(kpis);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const res = await fetch("/api/command");
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setLiveKpis({
          available: data.statusMap?.available ?? 0,
          loaded: data.statusMap?.loaded ?? 0,
          inTransit: data.statusMap?.in_transit ?? 0,
          delivered: data.statusMap?.delivered ?? 0,
          returning: data.statusMap?.returning ?? 0,
          damaged: (data.statusMap?.damaged ?? 0) + (data.statusMap?.under_repair ?? 0),
          retired: data.statusMap?.retired ?? 0,
          total: data.total ?? 0,
        });
      } catch {
        // keep the last known values if the refresh call fails
      }
    };

    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const tiles = [
    {
      label: "Available",
      value: String(liveKpis.available),
      hint: "Ready for loading",
      href: "/admin/pallets?status=available",
      icon: Package,
      tone: "from-emerald-600 to-teal-500",
    },
    {
      label: "In Transit",
      value: String(liveKpis.inTransit),
      hint: "Currently dispatched",
      href: "/admin/pallets?status=in_transit",
      icon: Truck,
      tone: "from-violet-600 to-indigo-500",
    },
    {
      label: "Returning",
      value: String(liveKpis.returning),
      hint: "Awaiting factory receipt",
      href: "/admin/pallets?status=returning",
      icon: RotateCcw,
      tone: "from-amber-500 to-yellow-500",
    },
    {
      label: "Damaged",
      value: String(liveKpis.damaged),
      hint: "Needs attention",
      href: "/admin/pallets?status=damaged",
      icon: AlertTriangle,
      tone: "from-red-600 to-rose-500",
    },
  ];

  const pipeline = [
    { l: "Available", v: liveKpis.available, c: "bg-emerald-500" },
    { l: "Loaded", v: liveKpis.loaded, c: "bg-blue-500" },
    { l: "In Transit", v: liveKpis.inTransit, c: "bg-violet-500" },
    { l: "Delivered", v: liveKpis.delivered, c: "bg-sky-500" },
    { l: "Returning", v: liveKpis.returning, c: "bg-amber-500" },
    { l: "Damaged", v: liveKpis.damaged, c: "bg-red-500" },
    { l: "Retired", v: liveKpis.retired, c: "bg-slate-400" },
  ];
  const pipeMax = Math.max(...pipeline.map((p) => p.v), 1);

  return (
    <PageReveal className="space-y-6">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-navy-950 via-blue-900 to-blue-600 p-5 text-white shadow-2xl shadow-blue-900/25 sm:p-8"
      >
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <motion.div
            className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-sky-400/25 blur-3xl"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 7, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-4 -left-2 text-sky-200/15"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
          >
            <Package size={80} strokeWidth={1.1} />
          </motion.div>
        </div>
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 sm:pl-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
              Executive dashboard
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome, {first}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-blue-100/90">
              {liveKpis.total} pallets tracked · {liveKpis.available} available · {liveKpis.inTransit} in transit · {userCount} users
            </p>
          </div>
          <div className="relative z-20 flex w-full shrink-0 flex-wrap gap-2 rounded-2xl border border-white/20 bg-navy-950/45 p-2 shadow-lg backdrop-blur-md sm:w-auto sm:max-w-sm sm:justify-end">
            <Link
              href="/admin/scan"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-navy-900 shadow-md"
            >
              <QrCode size={14} /> Scan pallet
            </Link>
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-xs font-bold text-white ring-1 ring-white/25"
            >
              <BarChart3 size={14} /> Reports
            </Link>
          </div>
        </div>
      </motion.section>

      {/* KPI tiles */}
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <StaggerItem key={t.label}>
            <Link href={t.href} className="group block">
              <motion.div
                whileHover={{ y: -3 }}
                className="relative overflow-hidden rounded-[1.35rem] bg-white p-5 shadow-lg shadow-blue-900/5 ring-1 ring-line/80 transition group-hover:ring-blue-200"
              >
                <div
                  className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${t.tone} text-white shadow-md`}
                >
                  <t.icon size={20} />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {t.label}
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-navy-900">
                  {t.value}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                  {t.hint}
                  <ArrowUpRight
                    size={12}
                    className="opacity-0 transition group-hover:opacity-100"
                  />
                </p>
              </motion.div>
            </Link>
          </StaggerItem>
        ))}
      </StaggerList>

      {/* Pipeline */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="premium-card !p-5 ring-1 ring-blue-100/50"
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Package size={18} />
          </div>
          <div>
            <h2 className="font-display font-bold text-navy-900">
              Pallet lifecycle pipeline
            </h2>
            <p className="text-xs text-muted">
              Live counts across the full lifecycle
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {pipeline.map((p) => (
            <div key={p.l} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs font-bold text-muted">
                {p.l}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className={`h-full rounded-full ${p.c}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(p.v / pipeMax) * 100}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
              <span className="w-8 text-right font-display text-sm font-bold text-navy-900">
                {p.v}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/pallets"
            className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 ring-1 ring-blue-100"
          >
            Manage pallets
          </Link>
        </div>
      </motion.section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent pallets */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-card !p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display font-bold text-navy-900">
              Recent pallets
            </h2>
            <Link
              href="/admin/pallets"
              className="text-xs font-bold text-blue-700 hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {recentPallets.length === 0 ? (
              <li className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">
                No pallets registered yet.
              </li>
            ) : (
              recentPallets.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/pallets/${p.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2.5 transition hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-navy-900 mono-code">
                        {p.palletNumber}
                      </p>
                      <p className="text-[11px] text-muted">
                        {p.currentLocation || "No location"}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800 ring-1 ring-blue-600/15">
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </motion.section>

        {/* Activity */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="premium-card !p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <Activity size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-navy-900">
                Scan activity
              </h2>
              <p className="text-xs text-muted">Latest lifecycle events</p>
            </div>
          </div>
          <ul className="max-h-[280px] space-y-2 overflow-y-auto admin-scroll">
            {events.length === 0 ? (
              <li className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">
                No scans yet.
              </li>
            ) : (
              events.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-xl border border-line bg-surface/70 px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold capitalize text-blue-800">
                      {ev.action.replace(/_/g, " ")}
                    </span>
                    <span className="mono-code text-[11px] font-bold">
                      {ev.palletNumber}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {ev.userName || "System"}
                  </p>
                </li>
              ))
            )}
          </ul>
        </motion.section>
      </div>

      {/* Workforce summary */}
      {byRole.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-card !p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <Package size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-navy-900">Workforce</h2>
              <p className="text-xs text-muted">{userCount} accounts</p>
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:grid-cols-4">
            {byRole.map((r) => (
              <li
                key={r.role}
                className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 break-words font-semibold capitalize text-ink">
                  {r.role.replace(/_/g, " ")}
                </span>
                <span className="font-display text-base font-bold text-blue-700">
                  {r.count}
                </span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </PageReveal>
  );
}

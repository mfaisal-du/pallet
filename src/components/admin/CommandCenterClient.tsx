"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { Badge } from "@/components/ui/Badge";
import { ScannerView } from "@/components/ui/ScannerView";
import { STATUS_COLORS } from "@/lib/pallet-machine";
import { useStatusLabels } from "@/components/layout/StatusLabelsProvider";
import Link from "next/link";
import {
  Package, Truck, MapPin, RotateCcw, AlertTriangle,
  Activity, RefreshCw, Clock, CheckCircle2, HelpCircle,
  ArrowRight, Search, QrCode,
  Hash, Layers, BarChart2, TrendingUp,
} from "lucide-react";
import type { PalletStatus } from "@/lib/pallet-machine";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusMap = Record<string, number>;
type ActivityItem = {
  id: string; action: string; palletNumber: string;
  userName: string; fromStatus: string | null; toStatus: string | null; createdAt: string;
};
type HourBucket = { hour: number; count: number };
type AlertItem = {
  id: string; palletNumber: string; status?: string;
  updatedAt?: string; returnDueDate?: string | null; currentLocation?: string | null;
};
type CommandData = {
  statusMap: StatusMap; total: number; overdueCount: number; throughput7d: number;
  recentActivity: ActivityItem[]; hourBuckets: HourBucket[];
  alerts: { damaged: AlertItem[]; lost: AlertItem[]; overdue: AlertItem[] };
};
type PalletResult = {
  id: string; palletNumber: string; status: string; materialType: string;
  dimensions: string; tripCount: number; currentLocation: string | null;
  returnDueDate: string | null; updatedAt?: string; createdAt?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  { key: "available",  color: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-200", icon: Package },
  { key: "loaded",     color: "text-sky-700",     bg: "bg-sky-100",     border: "border-sky-200",     icon: Package },
  { key: "in_transit", color: "text-violet-700",  bg: "bg-violet-100",  border: "border-violet-200",  icon: Truck },
  { key: "delivered",  color: "text-blue-700",    bg: "bg-blue-100",    border: "border-blue-200",    icon: MapPin },
  { key: "returning",  color: "text-amber-700",   bg: "bg-amber-100",   border: "border-amber-200",   icon: RotateCcw },
];

const OFFSTAGE = [
  { key: "damaged",      color: "text-red-600",    bg: "bg-red-50",     border: "border-red-200" },
  { key: "under_repair", color: "text-orange-600", bg: "bg-orange-50",  border: "border-orange-200" },
  { key: "retired",      color: "text-slate-600",  bg: "bg-slate-50",   border: "border-slate-200" },
  { key: "lost",         color: "text-red-700",    bg: "bg-red-50",     border: "border-red-200" },
];

const ACTION_LABELS: Record<string, string> = {
  register: "Registered at factory", load: "Loaded onto truck",
  dispatch: "Dispatched out", deliver: "Delivered to customer",
  return_pickup: "Picked up for return", receive_factory: "Received at factory",
  mark_damaged: "Marked as damaged", begin_repair: "Repair started",
  complete_repair: "Repair completed", retire: "Retired from service",
  mark_lost: "Marked as lost", admin_override: "Admin override",
};

const ACTION_DOT: Record<string, string> = {
  register: "bg-emerald-500", load: "bg-sky-500", dispatch: "bg-violet-500",
  deliver: "bg-blue-500", return_pickup: "bg-amber-500", receive_factory: "bg-emerald-500",
  mark_damaged: "bg-red-500", begin_repair: "bg-orange-500", complete_repair: "bg-emerald-500",
  retire: "bg-slate-500", mark_lost: "bg-red-600", admin_override: "bg-indigo-500",
};

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ buckets }: { buckets: HourBucket[] }) {
  if (!buckets.length) return null;
  const max = Math.max(...buckets.map(b => b.count), 1);
  const W = 200; const H = 28;
  const pts = buckets.map((b, i) => `${(i / (buckets.length - 1)) * W},${H - (b.count / max) * H}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
      <polyline fill="url(#sg2)" stroke="none" points={`0,${H} ${pts} ${W},${H}`} />
    </svg>
  );
}

// ─── Pallet Result Card ────────────────────────────────────────────────────────

function PalletResultCard({ result }: { result: PalletResult }) {
  const labels = useStatusLabels();
  const tone = (STATUS_COLORS[result.status as PalletStatus] ?? "neutral") as "ok" | "warn" | "neutral" | "danger";
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-4 shadow-sm">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-lg font-black text-navy-900">{result.palletNumber}</p>
          <p className="text-xs text-muted">Pallet ID: {result.id.slice(0, 12)}…</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{labels[result.status as PalletStatus] || result.status}</Badge>
          <Link href={`/admin/pallets/${result.id}`}
            className="flex items-center gap-1.5 rounded-xl bg-navy-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-800 transition">
            Open Profile <ArrowRight size={11} />
          </Link>
        </div>
      </div>
      {/* Detail grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: Layers, label: "Material", value: result.materialType },
          { icon: Hash, label: "Dimensions", value: result.dimensions || "—" },
          { icon: BarChart2, label: "Trips", value: String(result.tripCount) },
          { icon: MapPin, label: "Location", value: result.currentLocation || "Not set" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-2 rounded-xl border border-white bg-white px-3 py-2.5 shadow-sm">
            <Icon size={13} className="mt-0.5 shrink-0 text-indigo-400" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
              <p className="break-words text-xs font-semibold text-navy-900 capitalize">{value}</p>
            </div>
          </div>
        ))}
      </div>
      {result.returnDueDate && (
        <div className={`mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${new Date(result.returnDueDate) < new Date() ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
          <Clock size={12} />
          {new Date(result.returnDueDate) < new Date() ? "⚠ Overdue since " : "Return due: "}
          {new Date(result.returnDueDate).toLocaleDateString()}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CommandCenterClient() {
  const labels = useStatusLabels();
  const [data, setData] = useState<CommandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Search / scan state
  const [lookupMode, setLookupMode] = useState<"type" | "scan">("type");
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<PalletResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/command");
      if (res.ok) { setData(await res.json()); setLastRefresh(new Date()); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchData]);

  async function lookupPallet(code: string) {
    const q = code.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/pallets/scan?code=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (res.ok && json.pallet) {
        const p = json.pallet;
        setSearchResult({
          id: p.id, palletNumber: p.palletNumber, status: p.status,
          materialType: p.materialType, dimensions: p.dimensions,
          tripCount: p.tripCount, currentLocation: p.currentLocation,
          returnDueDate: p.returnDueDate,
        });
      } else {
        setSearchError("Pallet not found. Check the number and try again.");
      }
    } catch {
      setSearchError("Network error. Please try again.");
    } finally { setSearching(false); }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    lookupPallet(searchQ);
  }

  const sm = data?.statusMap ?? {};
  const total = data?.total ?? 0;
  const alertCount = (data?.alerts.damaged.length ?? 0) + (data?.alerts.lost.length ?? 0) + (data?.alerts.overdue.length ?? 0);

  return (
    <PageReveal className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">Live · Auto-refresh every 30s</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-navy-900 sm:text-3xl">Command Center</h1>
          <p className="text-xs text-muted mt-0.5">Synced {lastRefresh.toLocaleTimeString()} · {total} total pallets</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {alertCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
              <AlertTriangle size={11} /> {alertCount} alert{alertCount !== 1 ? "s" : ""}
            </div>
          )}
          <button onClick={() => setAutoRefresh(v => !v)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${autoRefresh ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-line bg-white text-muted"}`}>
            {autoRefresh ? "Auto On" : "Auto Off"}
          </button>
          <button onClick={() => fetchData()}
            aria-label="Refresh command center"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-muted hover:text-navy-900 transition shadow-sm">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── PIPELINE ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {STAGES.map(({ key, color, bg, border, icon: Icon }, idx) => {
          const count = sm[key] ?? 0;
          return (
            <div key={key} className={`relative flex flex-col items-center rounded-2xl border ${border} ${bg} p-4 text-center`}>
              <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm`}>
                <Icon size={16} className={color} />
              </div>
              <motion.p className={`font-display text-2xl font-black ${color}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={`${key}-${count}`}>
                {count}
              </motion.p>
              <p className="mt-0.5 text-[10px] font-bold text-slate-500">{labels[key as PalletStatus] || key}</p>
              {idx < STAGES.length - 1 && (
                <ArrowRight size={11} className="absolute -right-2 top-1/2 -translate-y-1/2 text-slate-300 hidden md:block z-10" />
              )}
            </div>
          );
        })}
      </div>

      {/* Off-stage summary */}
      <div className="flex flex-wrap gap-2">
        {OFFSTAGE.map(({ key, color, bg, border }) => {
          const count = sm[key] ?? 0;
          return (
            <div key={key} className={`flex items-center gap-2 rounded-xl border ${border} ${bg} px-3 py-2`}>
              <span className={`text-xs font-bold ${color}`}>{labels[key as PalletStatus] || key}</span>
              <span className={`font-mono text-sm font-black ${count > 0 ? color : "text-slate-400"}`}>{count}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 ml-auto">
          <TrendingUp size={13} className="text-indigo-600" />
          <span className="text-xs font-bold text-indigo-700">Trips / 7d</span>
          <span className="font-mono text-sm font-black text-indigo-700">{data?.throughput7d ?? 0}</span>
        </div>
      </div>

      {/* ── PALLET LOOKUP ── */}
      <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-indigo-500" />
            <p className="text-sm font-bold text-navy-900">Pallet Lookup</p>
          </div>
          <div className="flex gap-1 rounded-lg border border-line bg-slate-50 p-0.5">
            <button onClick={() => { setLookupMode("type"); setSearchResult(null); setSearchError(null); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${lookupMode === "type" ? "bg-white shadow text-navy-900" : "text-muted"}`}>
              <Search size={11} /> Type
            </button>
            <button onClick={() => { setLookupMode("scan"); setSearchResult(null); setSearchError(null); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${lookupMode === "scan" ? "bg-white shadow text-navy-900" : "text-muted"}`}>
              <QrCode size={11} /> Scan QR
            </button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {lookupMode === "type" ? (
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input-premium min-w-0 flex-1 font-mono text-sm"
                placeholder="Enter pallet number (e.g. PT-MS24JRRVQ46N)"
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); setSearchResult(null); setSearchError(null); }}
              />
              <button type="submit" disabled={!searchQ.trim() || searching}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition disabled:opacity-40">
                {searching ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />} Look up
              </button>
            </form>
          ) : (
            <div className="rounded-xl overflow-hidden border border-line">
              <ScannerView
                accent="admin"
                label="Scan pallet QR code"
                placeholder="PT-…"
                onScan={(code) => { setLookupMode("type"); setSearchQ(code); lookupPallet(code); }}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {searching && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 py-4 text-xs text-muted justify-center">
                <RefreshCw size={13} className="animate-spin text-indigo-400" /> Looking up pallet…
              </motion.div>
            )}
            {searchError && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                <AlertTriangle size={14} className="shrink-0" /> {searchError}
              </motion.div>
            )}
            {searchResult && !searching && (
              <PalletResultCard key={searchResult.id} result={searchResult} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid gap-4 xl:grid-cols-3">

        {/* ── Activity Feed ── */}
        <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-indigo-500" />
              <p className="text-sm font-bold text-navy-900">Live Activity Feed</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 opacity-70">{data && <Sparkline buckets={data.hourBuckets} />}</div>
              <span className="text-[10px] text-muted flex items-center gap-1"><Clock size={9} /> 24h</span>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-line sm:max-h-[420px]">
            {(data?.recentActivity ?? []).map(item => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/70 transition">
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTION_DOT[item.action] ?? "bg-slate-300"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-navy-900">
                    <Link href={`/admin/pallets?q=${item.palletNumber}`} className="break-all font-mono font-bold hover:underline">{item.palletNumber}</Link>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="text-slate-600">{ACTION_LABELS[item.action] || item.action}</span>
                  </p>
                  <p className="text-[10px] text-muted">{item.userName}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted tabular-nums">{timeAgo(item.createdAt)}</span>
              </div>
            ))}
            {(data?.recentActivity ?? []).length === 0 && (
              <div className="py-12 text-center text-xs text-muted">No activity yet.</div>
            )}
          </div>
        </div>

        {/* ── Alerts ── */}
        <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <AlertTriangle size={14} className={alertCount > 0 ? "text-red-500" : "text-slate-400"} />
            <p className="text-sm font-bold text-navy-900">Alerts</p>
            {alertCount > 0 && (
              <span className="ml-auto rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">{alertCount}</span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-line sm:max-h-[420px]">
            {(data?.alerts.overdue ?? []).map(p => (
              <Link key={p.id} href={`/admin/pallets/${p.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-red-50/60 transition">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100">
                  <Clock size={14} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-bold text-navy-900 truncate">{p.palletNumber}</p>
                  <p className="text-[11px] text-red-600 font-semibold">Overdue return</p>
                </div>
                <ArrowRight size={11} className="text-muted shrink-0" />
              </Link>
            ))}
            {(data?.alerts.damaged ?? []).map(p => (
              <Link key={p.id} href={`/admin/pallets/${p.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-orange-50/60 transition">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                  <AlertTriangle size={14} className="text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-bold text-navy-900 truncate">{p.palletNumber}</p>
                  <p className="text-[11px] text-orange-600 font-semibold capitalize">{labels[p.status as PalletStatus] || p.status}</p>
                </div>
                <ArrowRight size={11} className="text-muted shrink-0" />
              </Link>
            ))}
            {(data?.alerts.lost ?? []).map(p => (
              <Link key={p.id} href={`/admin/pallets/${p.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-red-50/60 transition">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100">
                  <HelpCircle size={14} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-bold text-navy-900 truncate">{p.palletNumber}</p>
                  <p className="text-[11px] text-red-600 font-semibold">Marked lost</p>
                </div>
                <ArrowRight size={11} className="text-muted shrink-0" />
              </Link>
            ))}
            {alertCount === 0 && (
              <div className="flex flex-col items-center gap-2 py-10">
                <CheckCircle2 size={28} className="text-emerald-500" />
                <p className="text-xs font-bold text-emerald-700">All clear</p>
                <p className="text-[10px] text-muted">No damaged, lost or overdue pallets</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageReveal>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { Badge } from "@/components/ui/Badge";
import { useStatusLabels } from "@/components/layout/StatusLabelsProvider";
import {
  Truck, Package, MapPin, Clock, AlertTriangle,
  ArrowRight, QrCode, CheckCircle2, Eye,
  Users, BarChart3, Layers,
} from "lucide-react";

type AvailablePallet = { id: string; palletNumber: string; materialType: string; currentLocation: string | null; createdAt: string };
type LoadedPallet = { id: string; palletNumber: string; materialType: string; currentLocation: string | null; updatedAt: string };
type DispatchInfo = { truckNumber: string; driverName: string; destination: string; dispatchedAt: string } | null;
type InTransitPallet = { id: string; palletNumber: string; materialType: string; currentLocation: string | null; returnDueDate: string | null; updatedAt: string; dispatchInfo: DispatchInfo };
type FleetTruck = { id: string; plateNumber: string; model: string; assignedDriverId: string | null };
type FleetDriver = { id: string; name: string; phone: string | null };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function DispatchPageClient({
  availablePallets,
  loadedPallets,
  inTransitPallets,
  activeTrucks,
  activeDrivers,
}: {
  availablePallets: AvailablePallet[];
  loadedPallets: LoadedPallet[];
  inTransitPallets: InTransitPallet[];
  activeTrucks: FleetTruck[];
  activeDrivers: FleetDriver[];
}) {
  const labels = useStatusLabels();
  const [tab, setTab] = useState<"ready" | "transit" | "fleet">("ready");
  const now = new Date();
  const overdueCount = inTransitPallets.filter(p => p.returnDueDate && new Date(p.returnDueDate) < now).length;

  // Build driver map for truck assignment display
  const driverMap: Record<string, FleetDriver> = {};
  for (const d of activeDrivers) driverMap[d.id] = d;

  return (
    <PageReveal className="space-y-6">
      {/* Hero */}
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#0a1628] via-indigo-950 to-violet-900 p-5 text-white shadow-xl sm:p-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl"
            animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity }} />
        </div>
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Dispatch Operations</h1>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/70">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />{loadedPallets.length} ready to dispatch</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-400" />{inTransitPallets.length} in transit</span>
              {overdueCount > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />{overdueCount} overdue</span>}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row">
            <Link href="/admin/trips" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-navy-900 hover:bg-sky-100 transition shadow-md">
              <Layers size={14} /> Batch Dispatch
            </Link>
            <Link href="/admin/scan" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition backdrop-blur-sm">
              <QrCode size={14} /> Open Scanner
            </Link>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {[
          { label: `${labels.available} (Not Loaded)`, value: availablePallets.length, color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Package },
          { label: `${labels.loaded} (Ready to Dispatch)`, value: loadedPallets.length, color: "bg-sky-50 text-sky-700 border-sky-200", icon: Package },
          { label: labels.in_transit, value: inTransitPallets.length, color: "bg-violet-50 text-violet-700 border-violet-200", icon: Truck },
          { label: "Overdue Returns", value: overdueCount, color: overdueCount > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200", icon: AlertTriangle },
          { label: "Active Fleet", value: activeTrucks.length, color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: BarChart3 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className={`flex min-w-[180px] flex-1 items-center gap-3 rounded-2xl border p-4 ${color}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60">
              <Icon size={18} />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{value}</p>
              <p className="text-[11px] font-semibold leading-tight opacity-80">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-line bg-white p-1 shadow-sm w-full sm:w-fit">
        {([
          { key: "ready", label: "Dispatch Pipeline", icon: Package, count: availablePallets.length + loadedPallets.length },
          { key: "transit", label: labels.in_transit, icon: Truck, count: inTransitPallets.length },
          { key: "fleet", label: "Fleet Status", icon: Users, count: activeTrucks.length },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition sm:px-4 ${tab === t.key ? "bg-navy-900 text-white shadow-md" : "text-muted hover:text-navy-900"}`}>
            <t.icon size={13} /> <span className="hidden sm:inline">{t.label}</span> <span className="sm:hidden">{t.key === "ready" ? "Pipeline" : t.key === "transit" ? "Transit" : "Fleet"}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── DISPATCH PIPELINE ── */}
        {tab === "ready" && (
          <motion.div key="ready" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

            {/* Step 1 – Available pallets (need loading first) */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">1</span>
                <p className="text-xs font-bold text-navy-900">Available — Scan to Load</p>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{availablePallets.length}</span>
              </div>
              {availablePallets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-white py-6 text-center text-xs text-muted">No available pallets waiting to be loaded.</div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-emerald-200 bg-white shadow-sm admin-scroll">
                  <table className="w-full min-w-[460px] text-left text-sm">
                    <thead className="border-b border-emerald-100 bg-emerald-50 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                      <tr>
                        <th className="px-5 py-3">Pallet</th>
                        <th className="px-4 py-3">Material</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3">Next Step</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {availablePallets.map(p => (
                        <tr key={p.id} className="hover:bg-emerald-50/40 transition">
                          <td className="px-5 py-3">
                            <Link href={`/admin/pallets/${p.id}`} className="font-mono font-bold text-navy-900 hover:underline text-xs">{p.palletNumber}</Link>
                          </td>
                          <td className="px-4 py-3 text-xs capitalize text-muted">{p.materialType}</td>
                          <td className="px-4 py-3 text-xs text-muted">{timeAgo(p.createdAt)}</td>
                          <td className="px-4 py-3">
                            <Link href="/admin/scan" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition">
                              <QrCode size={11} /> Scan to Load
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Step 2 – Loaded pallets (ready for dispatch) */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700">2</span>
                <p className="text-xs font-bold text-navy-900">Loaded — Ready to Dispatch</p>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">{loadedPallets.length}</span>
              </div>
            {loadedPallets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-white py-6 text-center text-xs text-muted">No loaded pallets waiting for dispatch.</div>
            ) : (
              <div className="space-y-2">
                <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm admin-scroll">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-line bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-5 py-3.5">Pallet</th>
                        <th className="px-4 py-3.5">Material</th>
                        <th className="px-4 py-3.5">Loaded</th>
                        <th className="px-4 py-3.5">Location</th>
                        <th className="px-4 py-3.5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {loadedPallets.map(p => (
                        <tr key={p.id} className="hover:bg-sky-50/40 transition">
                          <td className="px-5 py-3.5">
                            <span className="font-mono font-bold text-navy-900 text-xs">{p.palletNumber}</span>
                          </td>
                          <td className="px-4 py-3.5 text-xs capitalize text-muted">{p.materialType}</td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Clock size={10} /> {timeAgo(p.updatedAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {p.currentLocation ? (
                              <span className="flex items-center gap-1 text-xs text-muted"><MapPin size={10} /> {p.currentLocation}</span>
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            <Link href={`/admin/scan`}
                              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700 transition">
                              <Truck size={11} /> Dispatch
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                  <QrCode size={14} className="text-violet-600 shrink-0" />
                  <p className="text-xs font-semibold text-violet-900">
                    To dispatch: go to <Link href="/admin/scan" className="font-bold underline">Scanner</Link>, scan the pallet QR code, fill truck &amp; driver details, and submit.
                  </p>
                </div>
              </div>
            )}
            </div>

          </motion.div>
        )}

        {/* ── IN TRANSIT ── */}
        {tab === "transit" && (
          <motion.div key="transit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {inTransitPallets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white py-16 text-center">
                <Truck size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="font-bold text-navy-900">No pallets in transit</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {inTransitPallets.map(p => {
                  const isOverdue = !!(p.returnDueDate && new Date(p.returnDueDate) < now);
                  const info = p.dispatchInfo;
                  return (
                    <div key={p.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${isOverdue ? "border-red-200" : "border-line"}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOverdue ? "bg-red-100 text-red-600" : "bg-violet-100 text-violet-600"}`}>
                            <Truck size={16} />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-navy-900">{p.palletNumber}</span>
                              {isOverdue && <Badge tone="warn">Overdue</Badge>}
                              <Badge tone="neutral">{p.materialType}</Badge>
                            </div>
                            {info ? (
                              <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted">
                                <span className="flex items-center gap-1"><Truck size={10} className="text-violet-500" /> <strong className="text-navy-900">{info.truckNumber}</strong></span>
                                <span className="flex items-center gap-1"><Users size={10} className="text-violet-500" /> {info.driverName}</span>
                                {info.destination && <span className="flex items-center gap-1"><MapPin size={10} className="text-violet-500" /> {info.destination}</span>}
                                <span className="flex items-center gap-1"><Clock size={10} /> Dispatched {timeAgo(info.dispatchedAt)}</span>
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-muted">Dispatch details not available</p>
                            )}
                            {p.returnDueDate && (
                              <p className={`mt-1 text-[11px] font-semibold ${isOverdue ? "text-red-600" : "text-amber-700"}`}>
                                {isOverdue ? "⚠ Return overdue since " : "Return due: "}
                                {new Date(p.returnDueDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                          <Link href={`/admin/pallets/${p.id}`}
                            className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition">
                            <Eye size={11} /> View
                          </Link>
                          <Link href="/admin/scan"
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition">
                            <CheckCircle2 size={11} /> Deliver
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── FLEET STATUS ── */}
        {tab === "fleet" && (
          <motion.div key="fleet" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {activeTrucks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white py-16 text-center">
                <Truck size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="font-bold text-navy-900">No active trucks registered</p>
                <p className="mt-1 text-sm text-muted"><Link href="/admin/fleet" className="text-blue-600 font-bold hover:underline">Go to Fleet Management</Link> to add trucks and drivers.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted px-1">Trucks with assigned drivers. Manage assignments in <Link href="/admin/fleet" className="font-bold text-blue-600 hover:underline">Fleet Management</Link>.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeTrucks.map(truck => {
                    const assignedDriver = truck.assignedDriverId ? driverMap[truck.assignedDriverId] : null;
                    return (
                      <div key={truck.id} className={`rounded-2xl border p-4 bg-white shadow-sm ${assignedDriver ? "border-emerald-200" : "border-line"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${assignedDriver ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            <Truck size={16} />
                          </div>
                          <div>
                            <p className="font-mono font-bold text-navy-900">{truck.plateNumber}</p>
                            <p className="text-xs text-muted">{truck.model || "Truck"}</p>
                          </div>
                        </div>
                        {assignedDriver ? (
                          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-200 text-xs font-bold text-emerald-800">
                              {assignedDriver.name.slice(0, 1)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-emerald-900">{assignedDriver.name}</p>
                              {assignedDriver.phone && <p className="text-[11px] text-emerald-700">{assignedDriver.phone}</p>}
                            </div>
                            <span className="ml-auto"><Badge tone="ok">Assigned</Badge></span>
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-muted text-center">
                            No driver assigned — <Link href="/admin/fleet" className="font-bold text-blue-600 hover:underline">Assign →</Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lifecycle reminder */}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted">Full Pallet Lifecycle</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {[
            { label: labels.available, color: "bg-emerald-100 text-emerald-800" },
            { label: labels.loaded, color: "bg-blue-100 text-blue-800" },
            { label: labels.in_transit, color: "bg-violet-100 text-violet-800" },
            { label: labels.delivered, color: "bg-sky-100 text-sky-800" },
            { label: labels.returning, color: "bg-amber-100 text-amber-800" },
            { label: labels.available, color: "bg-emerald-100 text-emerald-800" },
          ].map((s, i, arr) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className={`rounded-full px-2.5 py-1 ${s.color}`}>{s.label}</span>
              {i < arr.length - 1 && <ArrowRight size={10} className="text-muted" />}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          All lifecycle transitions are scanned in the <Link href="/admin/scan" className="font-bold text-blue-600 hover:underline">Scan page</Link>. Each role sees only the actions they are permitted to perform.
        </p>
      </div>
    </PageReveal>
  );
}

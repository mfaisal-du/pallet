"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDataToolbar, type DataViewMode } from "@/components/admin/AdminDataToolbar";
import { PalletQrLabel } from "@/components/admin/PalletQrLabel";
import { STATUS_LABELS, STATUS_COLORS, type PalletStatus } from "@/lib/pallet-machine";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Eye,
  Package,
  Plus,
  Printer,
  QrCode,
  X,
  CheckSquare,
  Square,
  RotateCcw,
  Truck,
  ArrowRight,
} from "lucide-react";

type Pallet = {
  id: string;
  palletNumber: string;
  qrCode: string;
  status: PalletStatus;
  materialType: string;
  dimensions: string;
  weightCapacity: number;
  cost: number;
  tripCount: number;
  currentLocation: string | null;
  printedAt: string | null;
  createdAt: string;
};

type Filter = "all" | "available" | "in_transit" | "returning" | "damaged" | "unprinted" | "today" | "voided";

const PAGE_SIZE = 50;

const STATUS_FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "in_transit", label: "In transit" },
  { key: "returning", label: "Returning" },
  { key: "damaged", label: "Damaged" },
  { key: "unprinted", label: "Unprinted" },
  { key: "today", label: "Created today" },
  { key: "voided", label: "Voided" },
];

const URL_TO_FILTER: Record<string, Filter> = {
  available: "available",
  loaded: "in_transit",
  in_transit: "in_transit",
  returning: "returning",
  delivered: "all",
  damaged: "damaged",
  under_repair: "damaged",
  voided: "voided",
  lost: "voided",
  retired: "voided",
};

const DEFAULT_MATERIAL_TYPES = ["plastic", "wood", "metal", "composite"];

export function AdminPalletsClient({
  initialPallets,
  userRole = "warehouse_loader",
  materialTypes = DEFAULT_MATERIAL_TYPES,
  initialFilter,
}: {
  initialPallets: Pallet[];
  userRole?: string;
  materialTypes?: string[];
  initialFilter?: string;
}) {
  const toast = useToast();
  const canRegister = userRole === "administrator" || userRole === "manufacturing";
  const canVoid = userRole === "administrator";
  const isAdmin = userRole === "administrator" || userRole === "manager";
  const [pallets, setPallets] = useState<Pallet[]>(initialPallets);
  const [filter, setFilter] = useState<Filter>(
    initialFilter ? (URL_TO_FILTER[initialFilter] ?? "all") : "all"
  );
  const [materialFilter, setMaterialFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<DataViewMode>("table");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Register modal
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({
    palletNumber: "",
    manufactureDate: "",
    materialType: materialTypes[0] ?? "plastic",
    dimensions: "",
    weightCapacity: "",
    cost: "",
    notes: "",
  });
  const [regCount, setRegCount] = useState(1);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [createdPallets, setCreatedPallets] = useState<{ palletNumber: string; materialType: string; dimensions: string }[]>([]);

  // Void modal
  const [voidModalPalletId, setVoidModalPalletId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  // Quick print modal
  const [printModalPallet, setPrintModalPallet] = useState<Pallet | null>(null);
  const [printCount, setPrintCount] = useState(1);

  // KPIs — exclude voided (lost/retired) from active counts
  const kpis = useMemo(() => {
    const active = pallets.filter((p) => p.status !== "retired" && p.status !== "lost");
    const available = pallets.filter((p) => p.status === "available");
    const inTransit = pallets.filter((p) => p.status === "in_transit" || p.status === "loaded");
    const damaged = pallets.filter((p) => p.status === "damaged" || p.status === "under_repair");
    const unprinted = pallets.filter((p) => !p.printedAt && p.status === "available");
    const totalTrips = pallets.reduce((sum, p) => sum + p.tripCount, 0);
    return { active: active.length, available: available.length, inTransit: inTransit.length, damaged: damaged.length, unprinted: unprinted.length, totalTrips };
  }, [pallets]);

  // Filtering — "all" excludes voided (lost/retired), only visible under "Voided" chip
  const filtered = useMemo(() => {
    let result = pallets;
    const today = new Date().toISOString().slice(0, 10);

    if (filter === "available") result = result.filter((p) => p.status === "available");
    else if (filter === "in_transit") result = result.filter((p) => p.status === "in_transit" || p.status === "loaded");
    else if (filter === "returning") result = result.filter((p) => p.status === "returning");
    else if (filter === "damaged") result = result.filter((p) => p.status === "damaged" || p.status === "under_repair");
    else if (filter === "unprinted") result = result.filter((p) => !p.printedAt && p.status === "available");
    else if (filter === "today") result = result.filter((p) => p.createdAt.startsWith(today));
    else if (filter === "voided") result = result.filter((p) => p.status === "lost" || p.status === "retired");
    else result = result.filter((p) => p.status !== "lost" && p.status !== "retired"); // "all"

    if (materialFilter !== "all") {
      result = result.filter((p) => p.materialType === materialFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.palletNumber.toLowerCase().includes(q) ||
          p.materialType.toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q)
      );
    }

    return result;
  }, [pallets, filter, materialFilter, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  // Bulk selection
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selectedIds.has(p.id));

  function toggleSelectAll() {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map((p) => p.id)));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Register
  async function handleRegister() {
    setRegSubmitting(true);
    try {
      const promises = Array.from({ length: regCount }).map(() =>
        fetch("/api/pallets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            palletNumber: regForm.palletNumber || undefined,
            manufactureDate: regForm.manufactureDate || new Date().toISOString(),
            materialType: regForm.materialType,
            dimensions: regForm.dimensions || "1200×800×150mm",
            weightCapacity: regForm.weightCapacity || 500,
            cost: regForm.cost || 0,
            notes: regForm.notes,
          }),
        }).then((r) => r.json())
      );
      const results = await Promise.all(promises);
      const created = results.filter((r) => r.pallet).map((r) => ({
        palletNumber: r.pallet.palletNumber,
        materialType: regForm.materialType,
        dimensions: regForm.dimensions || "1200×800×150mm",
      }));
      if (created.length > 0) {
        setCreatedPallets(created);
        toast.success(`${created.length} pallet${created.length > 1 ? "s" : ""} registered!`);
        const res = await fetch("/api/pallets");
        if (res.ok) {
          const data = await res.json();
          setPallets(data.pallets.map((p: Pallet) => ({ ...p, createdAt: p.createdAt })));
        }
      }
      setRegForm({ palletNumber: "", manufactureDate: "", materialType: materialTypes[0] ?? "plastic", dimensions: "", weightCapacity: "", cost: "", notes: "" });
      setRegCount(1);
    } catch { toast.error("Registration failed"); }
    finally { setRegSubmitting(false); }
  }

  // Void
  async function handleVoid() {
    if (!voidModalPalletId || !voidReason.trim()) return;
    setVoidSubmitting(true);
    try {
      const res = await fetch(`/api/pallets/${voidModalPalletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "lost", notes: voidReason }),
      });
      if (res.ok) {
        toast.success("Pallet voided — removed from active list");
        setPallets((prev) => prev.map((p) => p.id === voidModalPalletId ? { ...p, status: "lost" as PalletStatus } : p));
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || `Void failed (${res.status})`);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Network error"); }
    finally { setVoidSubmitting(false); setVoidModalPalletId(null); setVoidReason(""); }
  }

  // Actions helper for each pallet
  function actionsFor(p: Pallet) {
    const isVoided = p.status === "lost" || p.status === "retired";
    return (
      <div className="flex items-center gap-1">
        <Link href={`/admin/pallets/${p.id}`} className="rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] font-bold text-blue-700 transition hover:bg-blue-100">
          <Eye size={11} className="mr-0.5 inline" /> 360°
        </Link>
        {!isVoided && (
          <>
            <button onClick={() => { setPrintModalPallet(p); setPrintCount(1); }} className="rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100">
              <Printer size={11} className="mr-0.5 inline" /> Print
            </button>
            {canVoid && (
              <button onClick={() => setVoidModalPalletId(p.id)} className="rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700 transition hover:bg-red-100">
                <Ban size={11} className="mr-0.5 inline" /> Void
              </button>
            )}
          </>
        )}
        {isVoided && (
          <span className="text-[10px] font-bold text-slate-400 italic">voided</span>
        )}
      </div>
    );
  }

  return (
    <PageReveal className="space-y-6">
      <AdminPageHeader
        title="Pallets"
        subtitle={`${kpis.active} active · ${kpis.available} available · ${kpis.inTransit} in transit`}
        badge="lifecycle"
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Link href="/admin/scan" className="contents sm:block"><Button variant="white" className="w-full"><QrCode size={16} /> Scan</Button></Link>
            {canRegister && (
              <>
                <Button variant="white" onClick={() => setShowRegister(true)}><Plus size={16} /> Register pallet</Button>
                <Link href="/admin/pallets/labels" className="contents sm:block"><Button variant="white" className="w-full"><Printer size={16} /> Print labels</Button></Link>
              </>
            )}
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Active" value={kpis.active} gradient="from-blue-500 to-blue-700" icon={Package} />
        <KpiCard label="Available" value={kpis.available} gradient="from-emerald-500 to-emerald-700" icon={CheckCircle2} />
        <KpiCard label="In transit" value={kpis.inTransit} gradient="from-violet-500 to-purple-700" icon={Truck} />
        <KpiCard label="Damaged" value={kpis.damaged} gradient="from-orange-500 to-red-600" icon={AlertTriangle} highlight={kpis.damaged > 0} />
        <KpiCard label="Unprinted" value={kpis.unprinted} gradient="from-amber-500 to-orange-600" icon={Printer} highlight={kpis.unprinted > 0} />
        <KpiCard label="Total trips" value={kpis.totalTrips} gradient="from-sky-500 to-blue-600" icon={RotateCcw} />
      </div>

      {/* Created pallets banner */}
      <AnimatePresence>
        {createdPallets.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-emerald-900">{createdPallets.length} pallet{createdPallets.length > 1 ? "s" : ""} registered</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {createdPallets.map((p) => (
                    <span key={p.palletNumber} className="mono-code rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-800">{p.palletNumber}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setCreatedPallets([])} className="text-emerald-600 hover:text-emerald-900"><X size={16} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data toolbar with search + view toggle + status filters */}
      <AdminDataToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search pallets…"
        view={view}
        onViewChange={setView}
        count={filtered.length}
        trailing={
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button key={f.key} onClick={() => { setFilter(f.key); setVisibleCount(PAGE_SIZE); }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === f.key ? "bg-navy-900 text-white shadow-md" : "bg-white text-muted ring-1 ring-line hover:bg-surface"}`}>
                {f.label}
              </button>
            ))}
            {isAdmin && (
              <button onClick={() => setBulkMode(!bulkMode)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${bulkMode ? "bg-blue-600 text-white shadow-md" : "bg-white text-muted ring-1 ring-line hover:bg-surface"}`}>
                {bulkMode ? "Exit bulk" : "Bulk select"}
              </button>
            )}
          </div>
        }
      />

      {/* Material filter chips */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setMaterialFilter("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${materialFilter === "all" ? "bg-blue-700 text-white shadow-md" : "bg-white text-muted ring-1 ring-line hover:bg-surface"}`}>
          All ({pallets.filter((p) => p.status !== "lost" && p.status !== "retired").length})
        </button>
        {materialTypes.map((m) => {
          const count = pallets.filter((p) => p.materialType === m && p.status !== "lost" && p.status !== "retired").length;
          if (count === 0) return null;
          return (
            <button key={m} onClick={() => setMaterialFilter(m)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${materialFilter === m ? "bg-blue-700 text-white shadow-md" : "bg-white text-muted ring-1 ring-line hover:bg-surface"}`}>
              {m} ({count})
            </button>
          );
        })}
      </div>

      {/* Bulk selection bar */}
      {bulkMode && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
          <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
            {allVisibleSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            {allVisibleSelected ? "Deselect all" : "Select all"}
          </button>
          {selectedIds.size > 0 && <span className="text-xs font-bold text-blue-600">{selectedIds.size} selected</span>}
        </div>
      )}

      {/* ===== TABLE VIEW ===== */}
      {view === "table" && (
        <motion.div key="table" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[1.35rem] bg-white shadow-lg ring-1 ring-line/80">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-sky-50/50 text-[11px] uppercase text-muted">
                <tr>
                  {bulkMode && <th className="w-10 px-3 py-3.5 font-bold"><button onClick={toggleSelectAll}>{allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}</button></th>}
                  <th className="px-5 py-3.5 font-bold">Pallet</th>
                  <th className="px-4 py-3.5 font-bold">Material</th>
                  <th className="px-4 py-3.5 font-bold">Status</th>
                  <th className="px-4 py-3.5 font-bold">Trips</th>
                  <th className="px-4 py-3.5 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className={`border-t border-line/50 transition hover:bg-sky-50/40 ${selectedIds.has(p.id) ? "bg-blue-50/50" : ""}`}>
                    {bulkMode && (
                      <td className="px-3 py-3.5"><button onClick={() => toggleSelect(p.id)}>{selectedIds.has(p.id) ? <CheckSquare size={16} className="text-blue-700" /> : <Square size={16} className="text-muted" />}</button></td>
                    )}
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/pallets/${p.id}`} className="mono-code text-xs font-bold text-navy-900 hover:underline">{p.palletNumber}</Link>
                      {!p.printedAt && p.status === "available" && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">unprinted</span>}
                      <p className="text-[11px] text-muted">{p.dimensions}</p>
                    </td>
                    <td className="px-4 py-3.5"><span className="text-xs font-bold capitalize">{p.materialType}</span></td>
                    <td className="px-4 py-3.5"><Badge tone={STATUS_COLORS[p.status] as never}>{STATUS_LABELS[p.status]}</Badge></td>
                    <td className="px-4 py-3.5"><span className="font-mono text-sm font-bold">{p.tripCount}</span></td>
                    <td className="px-4 py-3.5">{actionsFor(p)}</td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={bulkMode ? 6 : 5} className="px-5 py-12 text-center text-sm text-muted">No pallets match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="border-t border-line bg-surface/50 px-5 py-3 text-center">
              <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-navy-900 shadow-sm ring-1 ring-line hover:bg-blue-50">
                <ChevronDown size={14} /> Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ===== LIST VIEW ===== */}
      {view === "list" && (
        <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          {visible.map((p) => {
            const isVoided = p.status === "lost" || p.status === "retired";
            return (
              <div key={p.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm ${isVoided ? "border-slate-200 opacity-60" : "border-line"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  {bulkMode && <button onClick={() => toggleSelect(p.id)}>{selectedIds.has(p.id) ? <CheckSquare size={16} className="text-blue-700" /> : <Square size={16} className="text-muted" />}</button>}
                  <div className="min-w-0">
                    <p className="mono-code text-sm font-bold text-navy-900">
                      {p.palletNumber}
                      {!p.printedAt && p.status === "available" && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">unprinted</span>}
                    </p>
                    <p className="text-xs text-muted">{p.materialType} · {p.dimensions} · {p.tripCount} trips</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_COLORS[p.status] as never}>{STATUS_LABELS[p.status]}</Badge>
                  {actionsFor(p)}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <p className="py-10 text-center text-sm text-muted">No pallets.</p>}
          {hasMore && (
            <div className="py-3 text-center">
              <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-navy-900 shadow-sm ring-1 ring-line hover:bg-blue-50">
                <ChevronDown size={14} /> Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ===== CARDS VIEW ===== */}
      {view === "cards" && (
        <motion.div key="cards" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const isVoided = p.status === "lost" || p.status === "retired";
            return (
              <article key={p.id} className={`premium-card !p-4 ring-1 ${isVoided ? "ring-slate-200 opacity-60" : "ring-line/70"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {bulkMode && <button onClick={() => toggleSelect(p.id)}>{selectedIds.has(p.id) ? <CheckSquare size={16} className="text-blue-700" /> : <Square size={16} className="text-muted" />}</button>}
                    <Link href={`/admin/pallets/${p.id}`} className="mono-code text-xs font-bold text-navy-900 hover:underline">{p.palletNumber}</Link>
                  </div>
                  <Badge tone={STATUS_COLORS[p.status] as never}>{STATUS_LABELS[p.status]}</Badge>
                </div>
                {!p.printedAt && p.status === "available" && <span className="mt-1 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">unprinted</span>}
                <p className="mt-2 text-sm font-semibold text-ink">{p.materialType} pallet</p>
                <p className="mt-1 text-xs text-muted">{p.dimensions} · {p.tripCount} trips</p>
                <div className="mt-3">{actionsFor(p)}</div>
              </article>
            );
          })}
          {visible.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted">No pallets.</p>}
          {hasMore && (
            <div className="col-span-full py-3 text-center">
              <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-navy-900 shadow-sm ring-1 ring-line hover:bg-blue-50">
                <ChevronDown size={14} /> Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Register modal */}
      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Register New Pallet" subtitle="Generate a new pallet record with QR code">
        <div className="space-y-5">
          {/* Section: Identification */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted"><Package size={11} /> Identification</p>
            <input className="input-premium mono-code w-full text-sm" placeholder="Pallet number (auto-generated if blank)" value={regForm.palletNumber} onChange={(e) => setRegForm({ ...regForm, palletNumber: e.target.value })} />
          </div>
          {/* Section: Details */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted"><Package size={11} /> Pallet Details</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold text-muted">Manufacture Date</label>
                <input type="date" className="input-premium mt-1 w-full text-sm" value={regForm.manufactureDate} onChange={(e) => setRegForm({ ...regForm, manufactureDate: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted">Material Type</label>
                <select className="input-premium mt-1 w-full text-sm capitalize" value={regForm.materialType} onChange={(e) => setRegForm({ ...regForm, materialType: e.target.value })}>
                  {materialTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted">Dimensions</label>
                <input className="input-premium mt-1 w-full text-sm" placeholder="1200×800×150mm" value={regForm.dimensions} onChange={(e) => setRegForm({ ...regForm, dimensions: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted">Weight Capacity (kg)</label>
                <input type="number" className="input-premium mt-1 w-full text-sm" placeholder="500" value={regForm.weightCapacity} onChange={(e) => setRegForm({ ...regForm, weightCapacity: e.target.value })} />
              </div>
            </div>
          </div>
          {/* Section: Financial */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold text-muted">Cost (OMR)</label>
              <input type="number" step="0.01" className="input-premium mt-1 w-full text-sm" placeholder="25.00" value={regForm.cost} onChange={(e) => setRegForm({ ...regForm, cost: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted">Notes</label>
              <input className="input-premium mt-1 w-full text-sm" placeholder="Optional notes" value={regForm.notes} onChange={(e) => setRegForm({ ...regForm, notes: e.target.value })} />
            </div>
          </div>
          {/* Quantity */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-slate-50 px-3 py-3 sm:px-4">
            <p className="text-xs font-bold text-navy-900">Quantity</p>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <button onClick={() => setRegCount(Math.max(1, regCount - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition font-bold text-base">−</button>
              <span className="w-8 text-center font-mono text-xl font-bold text-navy-900">{regCount}</span>
              <button onClick={() => setRegCount(Math.min(50, regCount + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition font-bold text-base">+</button>
            </div>
            <div className="grid w-full grid-cols-4 gap-1 sm:ml-3 sm:flex sm:w-auto">
              {[1, 5, 10, 25].map(n => (
                <button key={n} onClick={() => setRegCount(n)} className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${regCount === n ? "bg-navy-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{n}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
            <Button variant="secondary" fullWidth onClick={() => setShowRegister(false)}>Cancel</Button>
            <Button fullWidth disabled={regSubmitting} onClick={handleRegister}>
              {regSubmitting ? "Registering…" : `Generate ${regCount} QR Code${regCount > 1 ? "s" : ""}`} <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </Modal>

      {/* Void modal */}
      <Modal open={!!voidModalPalletId} onClose={() => { setVoidModalPalletId(null); setVoidReason(""); }} title="Void Pallet" subtitle="Mark pallet as lost — disappears from active list" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-900 ring-1 ring-red-100">
            <AlertTriangle size={14} className="mr-1 inline" />
            Voiding a pallet marks it as permanently lost. It will disappear from the active list and only appear under the &quot;Voided&quot; filter.
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted">Reason</label>
            <select className="input-premium mt-1 text-sm" value={voidReason} onChange={(e) => setVoidReason(e.target.value)}>
              <option value="">Select reason…</option>
              <option value="Created by mistake">Created by mistake</option>
              <option value="Pallet lost in transit">Pallet lost in transit</option>
              <option value="Destroyed beyond repair">Destroyed beyond repair</option>
              <option value="Duplicate registration">Duplicate registration</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => { setVoidModalPalletId(null); setVoidReason(""); }}>Cancel</Button>
            <Button variant="danger" fullWidth disabled={voidSubmitting || !voidReason.trim()} onClick={handleVoid}>{voidSubmitting ? "Voiding…" : "Void pallet"}</Button>
          </div>
        </div>
      </Modal>

      {/* Quick print modal */}
      <Modal open={!!printModalPallet} onClose={() => setPrintModalPallet(null)} title="Print QR Label" subtitle={printModalPallet?.palletNumber || ""} size="sm">
        {printModalPallet && (
          <div className="space-y-4">
            <div className="print-sheet rounded-2xl bg-slate-100/80 p-4 ring-1 ring-line">
              <div className="print-grid grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: printCount }).map((_, i) => (
                  <div key={i} className="print-label flex justify-center">
                    <PalletQrLabel palletNumber={printModalPallet.palletNumber} qrData={printModalPallet.qrCode} materialType={printModalPallet.materialType} dimensions={printModalPallet.dimensions} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm font-bold text-slate-700">Labels:</span>
              <button onClick={() => setPrintCount(Math.max(1, printCount - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">-</button>
              <span className="w-8 text-center font-mono text-lg font-bold text-navy-900">{printCount}</span>
              <button onClick={() => setPrintCount(Math.min(12, printCount + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">+</button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[1, 2, 4, 6, 8].map((n) => (
                <button key={n} onClick={() => setPrintCount(n)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${printCount === n ? "bg-blue-600 text-white shadow-md shadow-blue-600/25" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{n}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setPrintModalPallet(null)}>Cancel</Button>
              <Button fullWidth onClick={() => { window.print(); setPrintModalPallet(null); }}><Printer size={16} /> Print {printCount} label{printCount > 1 ? "s" : ""}</Button>
            </div>
          </div>
        )}
      </Modal>
    </PageReveal>
  );
}

function KpiCard({ label, value, gradient, icon: Icon, highlight = false }: { label: string; value: number; gradient: string; icon: typeof Package; highlight?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white shadow-lg ${highlight ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}>
      <Icon size={20} className="mb-2 text-white/80" />
      <p className="font-display text-2xl font-black tracking-tight">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">{label}</p>
    </div>
  );
}

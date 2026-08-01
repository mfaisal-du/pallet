"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { ScannerView } from "@/components/ui/ScannerView";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useStatusLabels } from "@/components/layout/StatusLabelsProvider";
import type { Role } from "@prisma/client";
import {
  Truck, RotateCcw, RefreshCw, Layers, Plus, CheckCircle2,
  Loader2, XCircle, MapPin, Clock, AlertTriangle, Users, Package,
  ClipboardList, Flag, ArrowRight,
} from "lucide-react";

type TripType = "dispatch" | "return_collection" | "factory_receive";

type Trip = {
  id: string;
  type: TripType;
  status: "open" | "closed" | "cancelled";
  truckNumber: string | null;
  driverName: string | null;
  destination: string | null;
  expectedDelivery: string | null;
  collector: string | null;
  inspector: string | null;
  scannedCount: number;
  failedCount: number;
  createdByName: string | null;
  createdAt: string;
  closedAt: string | null;
  movementCount: number;
};

type ManifestItem = {
  id: string;
  palletNumber: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  user: string;
  createdAt: string;
};

type LookupData = {
  id: string;
  palletNumber: string;
  status: string;
  materialType: string;
  currentLocation: string | null;
  tripCount: number;
};

type FleetTruck = { id: string; plateNumber: string; model: string; active: boolean };
type FleetDriver = { id: string; name: string; phone: string | null; active: boolean };

const CREATE_ROLES: Record<TripType, Role[]> = {
  dispatch: ["dispatcher", "administrator"],
  return_collection: ["return_collector", "administrator"],
  factory_receive: ["factory_receiver", "administrator"],
};

const TRIP_META: Record<TripType, { label: string; desc: string; icon: typeof Truck }> = {
  dispatch: { label: "Dispatch Trip", desc: "Truck + driver + destination saved once, then scan loaded pallets onto the truck.", icon: Truck },
  return_collection: { label: "Return Collection", desc: "Collector saved once, then scan returned pallets as they are picked up.", icon: RotateCcw },
  factory_receive: { label: "Factory Receive", desc: "Inspector saved once, then scan returned pallets as they arrive at the factory.", icon: RefreshCw },
};

// The pallet action each trip type applies to every scanned pallet.
const TRIP_EXPECTED_ACTION: Record<TripType, string[]> = {
  dispatch: ["dispatch"],
  return_collection: ["return_pickup"],
  factory_receive: ["receive_factory", "mark_damaged"],
};

export function TripManagerClient({
  userName,
  userRole,
  userRoles,
}: {
  userName: string;
  userRole: Role;
  userRoles?: Role[];
}) {
  const toast = useToast();
  const labels = useStatusLabels();

  const allowedTypes = useMemo(
    () => {
      const roles = userRoles && userRoles.length > 0 ? userRoles : [userRole];
      return (Object.keys(CREATE_ROLES) as TripType[]).filter((t) => CREATE_ROLES[t].some((r) => roles.includes(r)));
    },
    [userRoles, userRole]
  );

  // ── Trips list + selection
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ManifestItem[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [closing, setClosing] = useState(false);

  // ── New trip form
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState<TripType>("dispatch");
  const [dispatchForm, setDispatchForm] = useState({ truckNumber: "", truckId: "", driverName: "", driverId: "", destination: "", expectedDelivery: "", notes: "" });
  const [personName, setPersonName] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Scanning
  const [lookup, setLookup] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; pallet: LookupData; actions: string[] }>({ kind: "idle" });
  const [condition, setCondition] = useState<"Good" | "Damaged" | "Unknown">("Good");
  const [damageDesc, setDamageDesc] = useState("");
  const [notes, setNotes] = useState("");
  const [scanSubmitting, setScanSubmitting] = useState(false);

  // ── Fleet for dispatch trips
  const [fleetTrucks, setFleetTrucks] = useState<FleetTruck[]>([]);
  const [fleetDrivers, setFleetDrivers] = useState<FleetDriver[]>([]);

  const selected = trips.find((t) => t.id === selectedId) || null;

  async function loadTrips() {
    try {
      const res = await fetch("/api/trips?status=all");
      const data = await res.json();
      setTrips(data.trips || []);
    } catch {
      toast.error("Could not load trips");
    } finally {
      setLoadingTrips(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trips?status=all")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setTrips(d.trips || []); setLoadingTrips(false); } })
      .catch(() => { if (!cancelled) { toast.error("Could not load trips"); setLoadingTrips(false); } });
    // Fleet dropdowns for dispatch headers
    fetch("/api/fleet/trucks").then((r) => r.json()).then((d) => { if (!cancelled) setFleetTrucks((d.trucks || []).filter((t: FleetTruck) => t.active)); });
    fetch("/api/fleet/drivers").then((r) => r.json()).then((d) => { if (!cancelled) setFleetDrivers((d.drivers || []).filter((dr: FleetDriver) => dr.active)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectTrip(id: string) {
    setSelectedId(id);
    setLookup({ kind: "idle" });
    setCondition("Good");
    setDamageDesc("");
    setNotes("");
    try {
      const res = await fetch(`/api/trips/${id}`);
      const data = await res.json();
      if (res.ok) {
        const movements: ManifestItem[] = data.movements || [];
        setManifest(movements);
        // Refresh the trip counters in the list state so the header + summary
        // stay in sync after every scan (not just on create/close).
        if (data.trip) {
          setTrips((prev) =>
            prev.map((t) =>
              t.id === id
                ? {
                    ...t,
                    scannedCount: data.trip.scannedCount ?? t.scannedCount,
                    failedCount: data.trip.failedCount ?? t.failedCount,
                    movementCount: movements.length,
                  }
                : t
            )
          );
        }
      } else toast.error(data.error || "Could not load trip");
    } catch {
      toast.error("Network error");
    }
  }

  async function handleCreate() {
    if (newType === "dispatch") {
      if (!dispatchForm.truckNumber.trim()) { toast.error("Truck is required"); return; }
      if (!dispatchForm.driverName.trim()) { toast.error("Driver is required"); return; }
      if (!dispatchForm.destination.trim()) { toast.error("Destination is required"); return; }
    }
    if (newType === "return_collection" && !personName.trim()) { toast.error("Collector name is required"); return; }
    if (newType === "factory_receive" && !personName.trim()) { toast.error("Inspector name is required"); return; }

    setCreating(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          newType === "dispatch"
            ? { type: newType, ...dispatchForm }
            : { type: newType, [newType === "return_collection" ? "collector" : "inspector"]: personName.trim() }
        ),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Could not create trip"); return; }
      toast.success(TRIP_META[newType].label + " created — start scanning");
      setShowCreate(false);
      setPersonName("");
      setDispatchForm({ truckNumber: "", truckId: "", driverName: "", driverId: "", destination: "", expectedDelivery: "", notes: "" });
      await loadTrips();
      await selectTrip(data.trip.id);
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function handleScan(code: string) {
    if (!selected) return;
    setLookup({ kind: "loading" });
    setCondition("Good");
    setDamageDesc("");
    setNotes("");
    try {
      const res = await fetch(`/api/pallets/scan?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setLookup({ kind: "error", message: data.error || "Pallet not found" });
        return;
      }
      if (!data.permitted) {
        setLookup({ kind: "error", message: `Your role cannot act on this pallet (${labels[data.pallet.status as keyof typeof labels] || data.pallet.status}).` });
        return;
      }
      // The scan must match this trip type's action(s). A factory-receive trip
      // accepts both receive_factory and mark_damaged — the exact action is
      // chosen when the user picks the pallet condition.
      const expected = TRIP_EXPECTED_ACTION[selected.type];
      const actions: string[] = (data.roleTransitions || [])
        .filter((t: { action: string }) => expected.includes(t.action))
        .map((t: { action: string }) => t.action);
      if (actions.length === 0) {
        setLookup({ kind: "error", message: `This pallet is ${labels[data.pallet.status as keyof typeof labels] || data.pallet.status} — not ready for a ${TRIP_META[selected.type].label}.` });
        return;
      }
      setLookup({
        kind: "ready",
        pallet: {
          id: data.pallet.id,
          palletNumber: data.pallet.palletNumber,
          status: data.pallet.status,
          materialType: data.pallet.materialType,
          currentLocation: data.pallet.currentLocation,
          tripCount: data.pallet.tripCount,
        },
        actions,
      });
    } catch {
      setLookup({ kind: "error", message: "Network error — check your connection" });
    }
  }

  async function handleAddToTrip() {
    if (lookup.kind !== "ready" || !selected) return;
    if (selected.type !== "dispatch") {
      if (condition === "Damaged" && !damageDesc.trim()) { toast.error("Please describe the damage"); return; }
    }
    setScanSubmitting(true);
    try {
      // Resolve the action at submit time: factory-receive trips use
      // mark_damaged when the pallet is flagged damaged, receive_factory otherwise.
      let action = lookup.actions[0];
      if (selected.type === "factory_receive") {
        if (condition === "Damaged" && lookup.actions.includes("mark_damaged")) action = "mark_damaged";
        else action = "receive_factory";
      }
      const payload: Record<string, unknown> = {};
      if (selected.type === "return_collection") {
        payload.condition = condition;
        payload.notes = condition === "Damaged" ? damageDesc.trim() : notes.trim();
      }
      if (selected.type === "factory_receive") {
        payload.condition = condition;
        if (condition === "Damaged") payload.damageDesc = damageDesc.trim();
        payload.notes = notes.trim();
      }
      const res = await fetch("/api/pallets/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palletId: lookup.pallet.id,
          action,
          payload,
          tripId: selected.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLookup({ kind: "error", message: data.error || "Action failed" });
        return;
      }
      toast.success(`${lookup.pallet.palletNumber} added to trip`);
      setLookup({ kind: "idle" });
      await selectTrip(selected.id); // refresh manifest + counters
    } catch {
      toast.error("Network error");
    } finally {
      setScanSubmitting(false);
    }
  }

  async function handleCloseTrip() {
    if (!selected) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/trips/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Could not close trip"); return; }
      toast.success("Trip closed — batch complete");
      await loadTrips();
      setSelectedId(null);
      setManifest([]);
      setLookup({ kind: "idle" });
    } catch {
      toast.error("Network error");
    } finally {
      setClosing(false);
    }
  }

  const openTrips = trips.filter((t) => t.status === "open");
  const closedTrips = trips.filter((t) => t.status === "closed").slice(0, 8);
  const selectedMeta = selected ? TRIP_META[selected.type] : null;
  const conditionOptions: Array<"Good" | "Damaged" | "Unknown"> =
    selected?.type === "return_collection" ? ["Good", "Damaged", "Unknown"] : ["Good", "Damaged"];

  return (
    <PageReveal className="space-y-6">
      {/* Hero */}
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-navy-950 via-blue-900 to-sky-700 p-5 text-white shadow-xl sm:p-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <motion.div
            className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-400/25 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-100 backdrop-blur-md">
              <Layers size={11} /> Batch Scanning
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Batch Scanning</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-blue-50/90">
              Save the header once (truck, driver &amp; destination — or Collector/Inspector), then scan many pallets onto the same trip. One truck, one manifest, one summary.
            </p>
          </div>
          {allowedTypes.length > 0 && (
            <Button variant="white" className="sm:shrink-0" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> New Trip
            </Button>
          )}
        </div>
      </div>

      {/* Create trip form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="rounded-2xl border border-blue-200 bg-white p-5 shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-navy-900">Start a new batch</h2>
                <p className="text-xs text-muted">Choose the flow — the header below is saved once and applied to every pallet you scan.</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700" aria-label="Close">
                <XCircle size={18} />
              </button>
            </div>

            {/* Type selector */}
            <div className="grid gap-2 sm:grid-cols-3">
              {allowedTypes.map((t) => {
                const meta = TRIP_META[t];
                const Icon = meta.icon;
                const on = newType === t;
                return (
                  <button
                    key={t}
                    onClick={() => { setNewType(t); setPersonName(userName); }}
                    className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
                      on ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20" : "border-line hover:border-blue-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${on ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-navy-900">{meta.label}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted">{meta.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Header form */}
            {newType === "dispatch" ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted">Truck *</label>
                  <select className="input-premium mt-1 text-sm" value={dispatchForm.truckNumber}
                    onChange={(e) => {
                      const truck = fleetTrucks.find((t) => t.plateNumber === e.target.value);
                      setDispatchForm({ ...dispatchForm, truckNumber: e.target.value, truckId: truck?.id || "" });
                    }}>
                    <option value="">— Select truck —</option>
                    {fleetTrucks.map((t) => <option key={t.id} value={t.plateNumber}>{t.plateNumber}{t.model ? ` — ${t.model}` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted">Driver *</label>
                  <select className="input-premium mt-1 text-sm" value={dispatchForm.driverName}
                    onChange={(e) => {
                      const driver = fleetDrivers.find((d) => d.name === e.target.value);
                      setDispatchForm({ ...dispatchForm, driverName: e.target.value, driverId: driver?.id || "" });
                    }}>
                    <option value="">— Select driver —</option>
                    {fleetDrivers.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted">Destination *</label>
                  <input className="input-premium mt-1 text-sm" placeholder="Customer / warehouse" value={dispatchForm.destination}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted">Expected Delivery</label>
                  <input type="date" className="input-premium mt-1 text-sm" value={dispatchForm.expectedDelivery}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, expectedDelivery: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-muted">Notes</label>
                  <textarea rows={2} className="input-premium mt-1 text-sm" placeholder="Optional" value={dispatchForm.notes}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <label className="text-xs font-bold uppercase tracking-wide text-muted">
                  {newType === "return_collection" ? "Collector *" : "Inspector *"}
                </label>
                <input className="input-premium mt-1 text-sm" value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder={userName} />
                <p className="mt-1 text-[11px] text-muted">
                  Prefilled with your name ({userName}) — edit if a different person is physically collecting/inspecting.
                </p>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><ClipboardList size={15} /> Start Trip</>}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active trip workspace */}
      {selected && selectedMeta ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Left: trip header + scanner */}
          <div className="space-y-4">
            {/* Trip header card */}
            <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <selectedMeta.icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display font-bold text-navy-900">{selectedMeta.label}</h2>
                    {selected.status === "open" ? <Badge tone="ok">Open</Badge> : <Badge tone="neutral">{selected.status === "closed" ? "Closed" : "Cancelled"}</Badge>}
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {selected.scannedCount} scanned
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {selected.type === "dispatch" && <>Truck <strong className="text-navy-900">{selected.truckNumber || "—"}</strong> · Driver <strong className="text-navy-900">{selected.driverName || "—"}</strong> · <MapPin size={10} className="inline" /> {selected.destination || "—"}</>}
                    {selected.type === "return_collection" && <>Collector: <strong className="text-navy-900">{selected.collector || "—"}</strong></>}
                    {selected.type === "factory_receive" && <>Inspector: <strong className="text-navy-900">{selected.inspector || "—"}</strong></>}
                    {" · "}Started by {selected.createdByName || "Unknown"} · <Clock size={10} className="inline" /> {new Date(selected.createdAt).toLocaleString()}
                  </p>
                </div>
                {selected.status === "open" && (
                  <Button variant="danger" disabled={closing} onClick={handleCloseTrip} className="!min-h-10 !rounded-xl !px-3 !py-2 !text-xs">
                    {closing ? <><Loader2 size={14} className="animate-spin" /> Closing…</> : <><Flag size={14} /> Complete Trip</>}
                  </Button>
                )}
              </div>
            </div>

            {/* Scanner */}
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <selectedMeta.icon size={17} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-navy-900">Scan pallets onto this trip</h3>
                  <p className="text-xs text-muted">Each scan applies the {selectedMeta.label.toLowerCase()} step to that pallet.</p>
                </div>
              </div>

              {selected.status === "open" ? (
                <ScannerView onScan={handleScan} accent="admin" />
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-muted">
                  This trip is {selected.status === "closed" ? "closed" : "cancelled"} — no more pallets can be added. The manifest below is a read-only record.
                </div>
              )}

              {/* Lookup result */}
              <AnimatePresence mode="wait">
                {lookup.kind === "loading" && (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <Loader2 size={18} className="animate-spin text-blue-600" />
                    <span className="text-sm font-semibold text-slate-700">Looking up pallet…</span>
                  </motion.div>
                )}
                {lookup.kind === "error" && (
                  <motion.div key="error" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-900">Not added to this trip</p>
                      <p className="text-xs text-red-700">{lookup.message}</p>
                      <p className="mt-1 text-[11px] text-red-500">The batch continues — scan the next pallet.</p>
                    </div>
                    <button onClick={() => setLookup({ kind: "idle" })} className="text-red-400 hover:text-red-700"><XCircle size={16} /></button>
                  </motion.div>
                )}
                {lookup.kind === "ready" && (
                  <motion.div key="ready" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs font-bold uppercase tracking-wide text-muted">Pallet found</p>
                          <p className="font-display text-lg font-bold text-navy-900">{lookup.pallet.palletNumber}</p>
                        </div>
                        <Badge tone="blue">{labels[lookup.pallet.status as keyof typeof labels] || lookup.pallet.status}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span>{lookup.pallet.materialType}</span>
                        {lookup.pallet.currentLocation && <span><MapPin size={10} className="inline" /> {lookup.pallet.currentLocation}</span>}
                        <span>{lookup.pallet.tripCount} trips</span>
                      </div>
                    </div>

                    {/* Per-pallet condition for collection / receive */}
                    {selected.type !== "dispatch" && (
                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">Pallet condition *</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {conditionOptions.map((c) => (
                            <label key={c} className="flex cursor-pointer items-center gap-2">
                              <input type="radio" name="batch-condition" value={c} checked={condition === c}
                                onChange={() => setCondition(c)} className="accent-blue-600" />
                              <span className={`text-sm font-semibold ${c === "Damaged" ? "text-red-700" : c === "Good" ? "text-emerald-700" : ""}`}>{c}</span>
                            </label>
                          ))}
                        </div>
                        {condition === "Damaged" && (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-muted">Damage description *</label>
                            <textarea rows={2} className="input-premium mt-1 text-sm" placeholder="Describe the damage…" value={damageDesc}
                              onChange={(e) => setDamageDesc(e.target.value)} />
                          </div>
                        )}
                        {selected.type === "return_collection" && condition === "Good" && (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-muted">Pickup notes</label>
                            <textarea rows={2} className="input-premium mt-1 text-sm" placeholder="Optional" value={notes}
                              onChange={(e) => setNotes(e.target.value)} />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setLookup({ kind: "idle" })}>Discard</Button>
                      <Button className="flex-1" disabled={scanSubmitting} onClick={handleAddToTrip}>
                        {scanSubmitting ? <><Loader2 size={15} className="animate-spin" /> Adding…</> : <><CheckCircle2 size={15} /> Add to Trip</>}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>

          {/* Right: manifest */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display font-bold text-navy-900">Trip Manifest</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{manifest.length} pallets</span>
              </div>
              {manifest.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line py-10 text-center">
                  <Package size={24} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-xs text-muted">No pallets scanned yet.<br />Scan a QR code to add the first one.</p>
                </div>
              ) : (
                <div className="max-h-[520px] space-y-2 overflow-y-auto admin-scroll pr-1">
                  {manifest.map((m, i) => (
                    <motion.div key={m.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-black text-blue-700">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-bold text-navy-900">{m.palletNumber}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                          {m.fromStatus} <ArrowRight size={9} className="text-slate-400" /> {m.toStatus}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary preview */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-800">Batch Summary</p>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-600" /> <strong>{selected.scannedCount}</strong> scanned</span>
                <span className="flex items-center gap-1.5"><AlertTriangle size={14} className="text-red-500" /> <strong>{selected.failedCount}</strong> failed</span>
              </div>
              <p className="mt-2 text-[11px] text-blue-700">
                {selected.status === "open"
                  ? <>Click <strong>Complete Trip</strong> when all pallets are scanned to close the batch.</>
                  : <>This batch was {selected.status === "closed" ? "closed" : "cancelled"} on {selected.closedAt ? new Date(selected.closedAt).toLocaleDateString() : "—"}.</>}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Trip list when nothing is selected */
        <div className="space-y-6">
          {/* Open trips */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy-900">Open trips</h2>
              <span className="text-xs text-muted">Resume a trip to keep scanning</span>
            </div>
            {loadingTrips ? (
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-5 text-sm text-muted">
                <Loader2 size={16} className="animate-spin text-blue-600" /> Loading trips…
              </div>
            ) : openTrips.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white py-12 text-center">
                <Layers size={30} className="mx-auto mb-3 text-slate-300" />
                <p className="font-bold text-navy-900">No open trips</p>
                <p className="mt-1 text-sm text-muted">Create a trip to batch-scan pallets — the header is saved once, then every pallet scan uses it.</p>
                {allowedTypes.length > 0 && (
                  <Button className="mt-4" onClick={() => setShowCreate(true)}><Plus size={15} /> New Trip</Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {openTrips.map((t) => {
                  const meta = TRIP_META[t.type];
                  const Icon = meta.icon;
                  return (
                    <div key={t.id} className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Icon size={16} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-sm font-bold text-navy-900">{meta.label}</p>
                          <p className="truncate text-xs text-muted">
                            {t.type === "dispatch" && <>{t.truckNumber} · {t.driverName} · {t.destination}</>}
                            {t.type === "return_collection" && <>Collector: {t.collector || "—"}</>}
                            {t.type === "factory_receive" && <>Inspector: {t.inspector || "—"}</>}
                          </p>
                        </div>
                        <Badge tone="ok">Open</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="flex items-center gap-1"><Users size={11} /> {t.createdByName || "Unknown"}</span>
                        <span className="flex items-center gap-1"><Clock size={11} /> {new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                      <Button onClick={() => selectTrip(t.id)} className="!min-h-10 !text-xs">
                        <Layers size={14} /> Resume — {t.scannedCount} scanned
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent closed trips */}
          {closedTrips.length > 0 && (
            <div>
              <h2 className="mb-3 font-display text-lg font-bold text-navy-900">Recent completed trips</h2>
              <div className="space-y-2">
                {closedTrips.map((t) => {
                  const meta = TRIP_META[t.type];
                  const Icon = meta.icon;
                  return (
                    <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon size={15} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-navy-900">{meta.label}</p>
                        <p className="truncate text-xs text-muted">
                          {t.type === "dispatch" && <>{t.truckNumber} · {t.driverName} → {t.destination}</>}
                          {t.type === "return_collection" && <>Collector: {t.collector || "—"}</>}
                          {t.type === "factory_receive" && <>Inspector: {t.inspector || "—"}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600" /> {t.scannedCount} scanned</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {t.closedAt ? new Date(t.closedAt).toLocaleDateString() : ""}</span>
                      </div>
                      <Button variant="secondary" className="!min-h-9 !rounded-xl !px-3 !py-1.5 !text-xs" onClick={() => selectTrip(t.id)}>
                        View manifest
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loadingTrips && openTrips.length === 0 && closedTrips.length === 0 && allowedTypes.length === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              Your role ({userRole}) cannot create batch trips. Contact an administrator — batch scanning is available to Dispatchers, Return Collectors, Factory Receivers and Administrators.
            </div>
          )}
        </div>
      )}
    </PageReveal>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { ScannerView } from "@/components/ui/ScannerView";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/pallet-machine";
import type { Role } from "@prisma/client";
import {
  QrCode, Package, ArrowRight, CheckCircle2,
  Loader2, XCircle, Lock, MapPin, RotateCcw, Truck, RefreshCw,
  AlertTriangle, Plus, Minus, HelpCircle,
} from "lucide-react";

type ProductLine = { sku: string; qty: string; lot: string; weight: string };
type FleetTruck = { id: string; plateNumber: string; model: string; capacity: number; active: boolean };
type FleetDriver = { id: string; name: string; phone: string | null; licenseNo: string | null; active: boolean };

type PalletLookupData = {
  id: string;
  palletNumber: string;
  status: string;
  materialType: string;
  currentLocation: string | null;
  returnDueDate: string | null;
  tripCount: number;
};

type TransitionInfo = { action: string; formLabel: string; to: string };

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "denied"; pallet: PalletLookupData }
  | { kind: "ready"; pallet: PalletLookupData; transition: TransitionInfo | null; roleTransitions: TransitionInfo[] };

const ACTION_ICONS: Record<string, typeof Truck> = {
  load: Package,
  dispatch: Truck,
  deliver: MapPin,
  return_pickup: RotateCcw,
  receive_factory: RefreshCw,
  mark_damaged: AlertTriangle,
  mark_lost: HelpCircle,
  begin_repair: RefreshCw,
  complete_repair: CheckCircle2,
  retire: XCircle,
};

export function ScanPageClient({ userRole }: { userRole?: Role }) {
  const toast = useToast();
  const canRegister = userRole === "administrator" || userRole === "manufacturing";

  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const [actionDone, setActionDone] = useState<{ palletNumber: string; newStatus: string } | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Fleet data for dispatch form
  const [fleetTrucks, setFleetTrucks] = useState<FleetTruck[]>([]);
  const [fleetDrivers, setFleetDrivers] = useState<FleetDriver[]>([]);
  useEffect(() => {
    const canDispatch = userRole === "dispatcher" || userRole === "administrator" || userRole === "manager";
    if (!canDispatch) return;
    fetch("/api/fleet/trucks").then(r => r.json()).then(d => setFleetTrucks((d.trucks || []).filter((t: FleetTruck) => t.active)));
    fetch("/api/fleet/drivers").then(r => r.json()).then(d => setFleetDrivers((d.drivers || []).filter((dr: FleetDriver) => dr.active)));
  }, [userRole]);

  const [products, setProducts] = useState<ProductLine[]>([{ sku: "", qty: "", lot: "", weight: "" }]);
  const [dispatchForm, setDispatchForm] = useState({ truckNumber: "", driverName: "", driverContact: "", destination: "", expectedDelivery: "", notes: "" });
  const [deliverForm, setDeliverForm] = useState({ receiverName: "", receiverContact: "", notes: "" });
  const [pickupForm, setPickupForm] = useState({ pickupDriver: "", condition: "Good", notes: "" });
  const [receiveForm, setReceiveForm] = useState({ inspector: "", condition: "Good", damageDesc: "", notes: "" });
  const [lostForm, setLostForm] = useState({ reason: "", lastKnownLocation: "" });
  const [simpleNote, setSimpleNote] = useState("");

  function resetActionForms() {
    setProducts([{ sku: "", qty: "", lot: "", weight: "" }]);
    setDispatchForm({ truckNumber: "", driverName: "", driverContact: "", destination: "", expectedDelivery: "", notes: "" });
    setDeliverForm({ receiverName: "", receiverContact: "", notes: "" });
    setPickupForm({ pickupDriver: "", condition: "Good", notes: "" });
    setReceiveForm({ inspector: "", condition: "Good", damageDesc: "", notes: "" });
    setLostForm({ reason: "", lastKnownLocation: "" });
    setSimpleNote("");
  }

  async function lookupPallet(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLookup({ kind: "loading" });
    setActionDone(null);
    resetActionForms();
    try {
      const res = await fetch(`/api/pallets/scan?code=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setLookup({ kind: "error", message: data.error || "Pallet not found" });
        return;
      }
      if (!data.permitted) {
        setLookup({ kind: "denied", pallet: data.pallet });
      } else {
        setLookup({ kind: "ready", pallet: data.pallet, transition: data.transition ?? null, roleTransitions: data.roleTransitions ?? [] });
      }
    } catch {
      setLookup({ kind: "error", message: "Network error — check your connection" });
    }
  }

  function handleScan(code: string) {
    lookupPallet(code);
  }

  function handleReset() {
    setLookup({ kind: "idle" });
    setActionDone(null);
    resetActionForms();
  }

  async function submitAction(action: string, payload: Record<string, unknown>) {
    if (lookup.kind !== "ready") return;
    setActionSubmitting(true);
    try {
      const res = await fetch("/api/pallets/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palletId: lookup.pallet.id, action, payload }),
      });
      const data = await res.json();
      if (res.ok) {
        const newStatus = STATUS_LABELS[data.pallet.status as keyof typeof STATUS_LABELS] || data.pallet.status;
        setActionDone({ palletNumber: lookup.pallet.palletNumber, newStatus });
        toast.success(`${lookup.pallet.palletNumber} → ${newStatus}`);
        setLookup({ kind: "idle" });
        resetActionForms();
      } else {
        toast.error(data.error || "Action failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionSubmitting(false);
    }
  }

  function handleLoadSubmit() {
    const filled = products.filter((p) => p.sku.trim() || p.qty.trim());
    if (filled.length === 0) { toast.error("Add at least one product line"); return; }
    submitAction("load", { products: filled.map((p) => ({ sku: p.sku, qty: Number(p.qty) || 0, lot: p.lot, weight: Number(p.weight) || 0 })) });
  }
  function handleDispatchSubmit() {
    const truck = dispatchForm.truckNumber === "__manual__" ? "" : dispatchForm.truckNumber;
    const driver = dispatchForm.driverName === "__manual__" ? "" : dispatchForm.driverName;
    if (!truck.trim()) { toast.error("Truck number is required"); return; }
    if (!driver.trim()) { toast.error("Driver name is required"); return; }
    if (!dispatchForm.destination.trim()) { toast.error("Destination is required"); return; }
    submitAction("dispatch", { ...dispatchForm, truckNumber: truck, driverName: driver });
  }
  function handleDeliverSubmit() {
    if (!deliverForm.receiverName.trim()) { toast.error("Receiver name is required"); return; }
    submitAction("deliver", deliverForm);
  }
  function handlePickupSubmit() {
    if (!pickupForm.pickupDriver.trim()) { toast.error("Pickup driver is required"); return; }
    submitAction("return_pickup", pickupForm);
  }
  function handleReceiveSubmit() {
    if (!receiveForm.inspector.trim()) { toast.error("Inspector name is required"); return; }
    if (receiveForm.condition === "Damaged" && !receiveForm.damageDesc.trim()) { toast.error("Please describe the damage"); return; }
    const action = receiveForm.condition === "Damaged" ? "mark_damaged" : "receive_factory";
    submitAction(action, receiveForm);
  }
  function handleLostSubmit() {
    if (!lostForm.reason.trim()) { toast.error("Reason is required"); return; }
    submitAction("mark_lost", lostForm);
  }
  function handleSimpleSubmit(action: string) {
    submitAction(action, { notes: simpleNote });
  }

  return (
    <PageReveal className="space-y-6">
      {/* Hero */}
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-navy-950 via-blue-900 to-blue-700 p-5 text-white shadow-xl sm:p-6">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <motion.div
            className="absolute -left-16 -top-16 h-52 w-52 rounded-full bg-sky-400/30 blur-3xl"
            animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-100 backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-300" />
              </span>
              Live Scanner
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Scan Pallet
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-blue-50/90">
              Scan a QR code to look up a pallet and perform the next lifecycle action for your role.
            </p>
          </div>
          {canRegister && (
            <Link
              href="/admin/pallets/register"
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/20 sm:w-auto sm:shrink-0"
            >
              <Package size={13} /> Register new pallet
            </Link>
          )}
        </div>
      </div>

      {/* Action-done banner */}
      <AnimatePresence>
        {actionDone && (
          <motion.div
            key="action-done"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
          >
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-emerald-900">Action complete!</p>
              <p className="text-sm text-emerald-700">
                <span className="font-mono">{actionDone.palletNumber}</span> is now <strong>{actionDone.newStatus}</strong>. Scan the next pallet to continue.
              </p>
            </div>
            <button onClick={() => setActionDone(null)} className="ml-auto text-emerald-500 hover:text-emerald-700">
              <XCircle size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main scanner card — centred, generous width */}
      <div className="mx-auto max-w-2xl">
        <Card className="flex flex-col gap-4">
          {/* Card header */}
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <QrCode size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-navy-900">QR Scanner</h2>
              <p className="text-xs text-muted">Point camera at a pallet QR code, or type the code below</p>
            </div>
            {lookup.kind !== "idle" && (
              <button
                onClick={handleReset}
                className="ml-auto text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <RotateCcw size={12} /> Scan another
              </button>
            )}
          </div>

          <ScannerView onScan={handleScan} accent="admin" />

          {/* Lookup result */}
          <AnimatePresence mode="wait">
            {lookup.kind === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Loader2 size={20} className="animate-spin text-blue-600" />
                <span className="text-sm font-semibold text-slate-700">Looking up pallet…</span>
              </motion.div>
            )}
            {lookup.kind === "error" && (
              <motion.div key="error" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <XCircle size={20} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-900">Not found</p>
                  <p className="text-xs text-red-700">{lookup.message}</p>
                </div>
              </motion.div>
            )}
            {lookup.kind === "denied" && (
              <motion.div key="denied" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                <PalletInfoCard pallet={lookup.pallet} />
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <Lock size={20} className="text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Permission denied</p>
                    <p className="text-xs text-amber-700">
                      Your role cannot perform the next action on a pallet with status{" "}
                      <strong>{STATUS_LABELS[lookup.pallet.status as keyof typeof STATUS_LABELS] || lookup.pallet.status}</strong>.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
            {lookup.kind === "ready" && (
              <motion.div key="ready" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <PalletInfoCard pallet={lookup.pallet} />
                {lookup.transition ? (
                  <ActionForm
                    transition={lookup.transition}
                    products={products} setProducts={setProducts}
                    dispatchForm={dispatchForm} setDispatchForm={setDispatchForm}
                    deliverForm={deliverForm} setDeliverForm={setDeliverForm}
                    pickupForm={pickupForm} setPickupForm={setPickupForm}
                    receiveForm={receiveForm} setReceiveForm={setReceiveForm}
                    lostForm={lostForm} setLostForm={setLostForm}
                    simpleNote={simpleNote} setSimpleNote={setSimpleNote}
                    onLoad={handleLoadSubmit} onDispatch={handleDispatchSubmit}
                    onDeliver={handleDeliverSubmit} onPickup={handlePickupSubmit}
                    onReceive={handleReceiveSubmit} onLost={handleLostSubmit}
                    onSimple={handleSimpleSubmit}
                    submitting={actionSubmitting}
                    fleetTrucks={fleetTrucks}
                    fleetDrivers={fleetDrivers}
                  />
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-muted">
                    No further actions available for this pallet&apos;s current status.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </PageReveal>
  );
}

function PalletInfoCard({ pallet }: { pallet: PalletLookupData }) {
  const tone = (STATUS_COLORS[pallet.status as keyof typeof STATUS_COLORS] as string) || "blue";
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-bold text-muted uppercase tracking-wide">Pallet found</p>
          <p className="font-display text-lg font-bold text-navy-900">{pallet.palletNumber}</p>
        </div>
        <Badge tone={tone as never}>{STATUS_LABELS[pallet.status as keyof typeof STATUS_LABELS] || pallet.status}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>{pallet.materialType}</span>
        {pallet.currentLocation && <span className="flex items-center gap-1"><MapPin size={10} /> {pallet.currentLocation}</span>}
        <span>{pallet.tripCount} trips</span>
        {pallet.returnDueDate && (
          <span className="text-amber-700">Due: {new Date(pallet.returnDueDate).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}

function ActionForm({
  transition,
  products, setProducts,
  dispatchForm, setDispatchForm,
  deliverForm, setDeliverForm,
  pickupForm, setPickupForm,
  receiveForm, setReceiveForm,
  lostForm, setLostForm,
  simpleNote, setSimpleNote,
  onLoad, onDispatch, onDeliver, onPickup, onReceive, onLost, onSimple,
  submitting,
  fleetTrucks,
  fleetDrivers,
}: {
  transition: TransitionInfo;
  products: ProductLine[]; setProducts: (v: ProductLine[]) => void;
  dispatchForm: { truckNumber: string; driverName: string; driverContact: string; destination: string; expectedDelivery: string; notes: string };
  setDispatchForm: (v: { truckNumber: string; driverName: string; driverContact: string; destination: string; expectedDelivery: string; notes: string }) => void;
  deliverForm: { receiverName: string; receiverContact: string; notes: string };
  setDeliverForm: (v: { receiverName: string; receiverContact: string; notes: string }) => void;
  pickupForm: { pickupDriver: string; condition: string; notes: string };
  setPickupForm: (v: { pickupDriver: string; condition: string; notes: string }) => void;
  receiveForm: { inspector: string; condition: string; damageDesc: string; notes: string };
  setReceiveForm: (v: { inspector: string; condition: string; damageDesc: string; notes: string }) => void;
  lostForm: { reason: string; lastKnownLocation: string };
  setLostForm: (v: { reason: string; lastKnownLocation: string }) => void;
  simpleNote: string; setSimpleNote: (v: string) => void;
  onLoad: () => void; onDispatch: () => void; onDeliver: () => void; onPickup: () => void;
  onReceive: () => void; onLost: () => void; onSimple: (action: string) => void;
  submitting: boolean;
  fleetTrucks: FleetTruck[];
  fleetDrivers: FleetDriver[];
}) {
  const action = transition.action;
  const Icon = ACTION_ICONS[action] || ArrowRight;

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
          <Icon size={15} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Next action</p>
          <p className="font-display font-bold text-navy-900 text-sm">{transition.formLabel}</p>
        </div>
      </div>

      {action === "load" && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase text-muted">Products loaded onto pallet</p>
          {products.map((p, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input className="input-premium text-xs" placeholder="SKU / Product" value={p.sku}
                onChange={(e) => { const n = [...products]; n[i] = { ...n[i], sku: e.target.value }; setProducts(n); }} />
              <input type="number" className="input-premium text-xs" placeholder="Qty" value={p.qty}
                onChange={(e) => { const n = [...products]; n[i] = { ...n[i], qty: e.target.value }; setProducts(n); }} />
              <input className="input-premium text-xs" placeholder="Lot / Batch" value={p.lot}
                onChange={(e) => { const n = [...products]; n[i] = { ...n[i], lot: e.target.value }; setProducts(n); }} />
              <div className="flex gap-1">
                <input type="number" className="input-premium flex-1 text-xs" placeholder="kg" value={p.weight}
                  onChange={(e) => { const n = [...products]; n[i] = { ...n[i], weight: e.target.value }; setProducts(n); }} />
                {products.length > 1 && (
                  <button onClick={() => setProducts(products.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700"><Minus size={14} /></button>
                )}
              </div>
            </div>
          ))}
          <button onClick={() => setProducts([...products, { sku: "", qty: "", lot: "", weight: "" }])}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"><Plus size={12} /> Add product line</button>
          <Button fullWidth disabled={submitting} onClick={onLoad} className="!min-h-[44px]">
            {submitting ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Package size={15} /> Mark as Loaded</>}
          </Button>
        </div>
      )}

      {action === "dispatch" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase text-muted">Truck *</label>
              {fleetTrucks.length > 0 ? (
                <select className="input-premium mt-1 text-sm" value={dispatchForm.truckNumber}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, truckNumber: e.target.value })}>
                  <option value="">— Select truck —</option>
                  {fleetTrucks.map(t => (
                    <option key={t.id} value={t.plateNumber}>{t.plateNumber}{t.model ? ` — ${t.model}` : ""}</option>
                  ))}
                  <option value="__manual__">Other (type below)</option>
                </select>
              ) : (
                <input className="input-premium mt-1 text-sm" placeholder="Plate number (no trucks registered)" value={dispatchForm.truckNumber}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, truckNumber: e.target.value })} />
              )}
              {dispatchForm.truckNumber === "__manual__" && (
                <input className="input-premium mt-1 text-sm" placeholder="Enter plate number" autoFocus
                  onChange={(e) => setDispatchForm({ ...dispatchForm, truckNumber: e.target.value })} />
              )}
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted">Driver *</label>
              {fleetDrivers.length > 0 ? (
                <select className="input-premium mt-1 text-sm" value={dispatchForm.driverName}
                  onChange={(e) => {
                    const driver = fleetDrivers.find(d => d.name === e.target.value);
                    setDispatchForm({ ...dispatchForm, driverName: e.target.value, driverContact: driver?.phone || dispatchForm.driverContact });
                  }}>
                  <option value="">— Select driver —</option>
                  {fleetDrivers.map(d => (
                    <option key={d.id} value={d.name}>{d.name}{d.licenseNo ? ` (${d.licenseNo})` : ""}</option>
                  ))}
                  <option value="__manual__">Other (type below)</option>
                </select>
              ) : (
                <input className="input-premium mt-1 text-sm" placeholder="Driver name (none registered)" value={dispatchForm.driverName}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, driverName: e.target.value })} />
              )}
              {dispatchForm.driverName === "__manual__" && (
                <input className="input-premium mt-1 text-sm" placeholder="Enter driver name" autoFocus
                  onChange={(e) => setDispatchForm({ ...dispatchForm, driverName: e.target.value })} />
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase text-muted">Driver Contact</label>
              <input className="input-premium mt-1 text-sm" placeholder="+968 XXX XXXX" value={dispatchForm.driverContact}
                onChange={(e) => setDispatchForm({ ...dispatchForm, driverContact: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted">Destination *</label>
              <input className="input-premium mt-1 text-sm" placeholder="Customer / warehouse" value={dispatchForm.destination}
                onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Expected Delivery Date</label>
            <input type="date" className="input-premium mt-1 text-sm" value={dispatchForm.expectedDelivery}
              onChange={(e) => setDispatchForm({ ...dispatchForm, expectedDelivery: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Dispatch Notes</label>
            <textarea className="input-premium mt-1 text-sm" rows={2} placeholder="Optional notes" value={dispatchForm.notes}
              onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })} />
          </div>
          <Button fullWidth disabled={submitting} onClick={onDispatch} className="!min-h-[44px]">
            {submitting ? <><Loader2 size={15} className="animate-spin" /> Dispatching…</> : <><Truck size={15} /> Dispatch to Truck</>}
          </Button>
        </div>
      )}

      {action === "deliver" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase text-muted">Receiver Name *</label>
              <input className="input-premium mt-1 text-sm" placeholder="Receiver name" value={deliverForm.receiverName}
                onChange={(e) => setDeliverForm({ ...deliverForm, receiverName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted">Receiver Contact</label>
              <input className="input-premium mt-1 text-sm" placeholder="+968 XXX XXXX" value={deliverForm.receiverContact}
                onChange={(e) => setDeliverForm({ ...deliverForm, receiverContact: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Delivery Notes</label>
            <textarea className="input-premium mt-1 text-sm" rows={2} placeholder="Optional notes" value={deliverForm.notes}
              onChange={(e) => setDeliverForm({ ...deliverForm, notes: e.target.value })} />
          </div>
          <Button fullWidth disabled={submitting} onClick={onDeliver} className="!min-h-[44px]">
            {submitting ? <><Loader2 size={15} className="animate-spin" /> Confirming…</> : <><MapPin size={15} /> Confirm Delivery</>}
          </Button>
        </div>
      )}

      {action === "return_pickup" && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-muted">Pickup Driver *</label>
            <input className="input-premium mt-1 text-sm" placeholder="Driver name" value={pickupForm.pickupDriver}
              onChange={(e) => setPickupForm({ ...pickupForm, pickupDriver: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Pallet Condition *</label>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {["Good", "Damaged", "Unknown"].map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="pickup-condition" value={c} checked={pickupForm.condition === c}
                    onChange={() => setPickupForm({ ...pickupForm, condition: c })} className="accent-blue-600" />
                  <span className="text-sm font-semibold">{c}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Pickup Notes</label>
            <textarea className="input-premium mt-1 text-sm" rows={2} placeholder="Optional notes" value={pickupForm.notes}
              onChange={(e) => setPickupForm({ ...pickupForm, notes: e.target.value })} />
          </div>
          <Button fullWidth disabled={submitting} onClick={onPickup} className="!min-h-[44px]">
            {submitting ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><RotateCcw size={15} /> Record Return Pickup</>}
          </Button>
        </div>
      )}

      {(action === "receive_factory" || action === "mark_damaged") && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-muted">Inspector Name *</label>
            <input className="input-premium mt-1 text-sm" placeholder="Inspector name" value={receiveForm.inspector}
              onChange={(e) => setReceiveForm({ ...receiveForm, inspector: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Condition *</label>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {["Good", "Damaged"].map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="receive-condition" value={c} checked={receiveForm.condition === c}
                    onChange={() => setReceiveForm({ ...receiveForm, condition: c })} className="accent-blue-600" />
                  <span className={`text-sm font-semibold ${c === "Damaged" ? "text-red-700" : "text-emerald-700"}`}>{c}</span>
                </label>
              ))}
            </div>
            {receiveForm.condition === "Good" && <p className="mt-1 text-xs text-emerald-700">→ Pallet returns to <strong>Available</strong> and trip count +1</p>}
            {receiveForm.condition === "Damaged" && <p className="mt-1 text-xs text-red-700">→ Pallet flagged as <strong>Damaged</strong></p>}
          </div>
          {receiveForm.condition === "Damaged" && (
            <div>
              <label className="text-xs font-bold uppercase text-muted">Damage Description *</label>
              <textarea className="input-premium mt-1 text-sm" rows={3} placeholder="Describe the damage in detail…"
                value={receiveForm.damageDesc} onChange={(e) => setReceiveForm({ ...receiveForm, damageDesc: e.target.value })} />
            </div>
          )}
          <div>
            <label className="text-xs font-bold uppercase text-muted">Notes</label>
            <textarea className="input-premium mt-1 text-sm" rows={2} placeholder="Optional inspection notes"
              value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} />
          </div>
          <Button fullWidth disabled={submitting} onClick={onReceive} className="!min-h-[44px]">
            {submitting ? (
              <><Loader2 size={15} className="animate-spin" /> Saving&hellip;</>
            ) : receiveForm.condition === "Damaged" ? (
              <><AlertTriangle size={15} /> Flag as Damaged</>
            ) : (
              <><RefreshCw size={15} /> Return to Available</>
            )}
          </Button>
        </div>
      )}

      {action === "mark_lost" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 font-semibold">
            ⚠ This permanently marks the pallet as <strong>Lost</strong>. Use only when the physical pallet cannot be located.
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Reason *</label>
            <textarea className="input-premium mt-1 text-sm" rows={3} placeholder="Describe how the pallet was lost…"
              value={lostForm.reason} onChange={(e) => setLostForm({ ...lostForm, reason: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Last Known Location</label>
            <input className="input-premium mt-1 text-sm" placeholder="e.g. Customer warehouse, Truck TK-05"
              value={lostForm.lastKnownLocation} onChange={(e) => setLostForm({ ...lostForm, lastKnownLocation: e.target.value })} />
          </div>
          <Button fullWidth disabled={submitting} onClick={onLost} className="!min-h-[44px] !bg-red-600 hover:!bg-red-700">
            {submitting ? <><Loader2 size={15} className="animate-spin" /> Saving&hellip;</> : <><HelpCircle size={15} /> Confirm Mark as Lost</>}
          </Button>
        </div>
      )}

      {(action === "begin_repair" || action === "complete_repair" || action === "retire") && (
        <div className="space-y-3">
          {action === "begin_repair" && <p className="text-xs text-blue-800">Pallet will move from <strong>Damaged</strong> → <strong>Under Repair</strong>.</p>}
          {action === "complete_repair" && <p className="text-xs text-emerald-800">Pallet will move from <strong>Under Repair</strong> → <strong>Available</strong>.</p>}
          {action === "retire" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 font-semibold">
              ⚠ Retiring a pallet is permanent. It will be removed from active circulation.
            </div>
          )}
          <div>
            <label className="text-xs font-bold uppercase text-muted">Notes</label>
            <textarea className="input-premium mt-1 text-sm" rows={2} placeholder="Optional notes…"
              value={simpleNote} onChange={(e) => setSimpleNote(e.target.value)} />
          </div>
          <Button
            fullWidth disabled={submitting}
            onClick={() => onSimple(action)}
            className={`!min-h-[44px] ${action === "retire" ? "!bg-slate-700 hover:!bg-slate-900" : ""}`}
          >
            {submitting ? (
              <><Loader2 size={15} className="animate-spin" /> Saving&hellip;</>
            ) : action === "begin_repair" ? (
              <><RefreshCw size={15} /> Begin Repair</>
            ) : action === "complete_repair" ? (
              <><CheckCircle2 size={15} /> Complete Repair</>
            ) : (
              <><XCircle size={15} /> Retire Pallet</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

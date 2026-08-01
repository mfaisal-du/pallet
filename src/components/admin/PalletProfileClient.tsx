"use client";

import { useState } from "react";
import Link from "next/link";
import { PageReveal } from "@/components/motion/PageReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PalletQrLabel } from "@/components/admin/PalletQrLabel";
import { STATUS_COLORS, getTransitionsFrom } from "@/lib/pallet-machine";
import { useStatusLabels } from "@/components/layout/StatusLabelsProvider";
import { formatDate, formatDateTime } from "@/lib/format-date";
import type { PalletStatus } from "@prisma/client";
import type { LabelConfig } from "@/lib/label-settings";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  History,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Ruler,
  Truck,
  User,
  Weight,
  AlertTriangle,
  Wrench,
} from "lucide-react";

type PalletData = {
  id: string;
  palletNumber: string;
  qrCode: string;
  status: string;
  manufactureDate: string;
  materialType: string;
  dimensions: string;
  weightCapacity: string;
  cost: string;
  notes: string | null;
  tripCount: number;
  currentLocation: string | null;
  returnDueDate: string | null;
  printedAt: string | null;
  createdAt: string;
  currentUser: { name: string; email: string } | null;
  movements: {
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    payload: unknown;
    note: string | null;
    createdAt: string;
    user: { name: string; role?: string } | null;
  }[];
  damageRecords: {
    id: string;
    description: string;
    resolved: boolean;
    createdAt: string;
  }[];
  qrDataUrl: string;
};

type TimelineSection = {
  title: string;
  description: string;
  movements: PalletData["movements"];
};

function buildTimelineSections(movements: PalletData["movements"]): TimelineSection[] {
  const sections: TimelineSection[] = [];

  movements.forEach((movement, index) => {
    const startsNewSection =
      index === 0 ||
      (movement.toStatus === "available" && ["register", "receive_factory", "complete_repair"].includes(movement.action));

    if (startsNewSection) {
      const cycleNumber = sections.length + 1;
      const title =
        movement.action === "register"
          ? `Cycle ${cycleNumber} · Factory registration`
          : movement.action === "receive_factory"
            ? `Cycle ${cycleNumber} · Return completed`
            : `Cycle ${cycleNumber} · Repair reset`;

      const description =
        movement.action === "register"
          ? "This section starts the pallet lifecycle from the factory pool."
          : movement.action === "receive_factory"
            ? "The pallet has returned and is ready for the next cycle."
            : "A new operational cycle begins after repair or reset.";

      sections.push({ title, description, movements: [movement] });
      return;
    }

    const lastSection = sections[sections.length - 1];
    if (lastSection) {
      lastSection.movements.push(movement);
    }
  });

  return sections;
}

const ACTION_ICONS: Record<string, typeof Truck> = {
  load: Package,
  dispatch: Truck,
  deliver: MapPin,
  return_pickup: RotateCcw,
  receive_factory: Package,
  mark_damaged: AlertTriangle,
  begin_repair: Wrench,
  complete_repair: RefreshCw,
  retire: AlertTriangle,
};

export function PalletProfileClient({ pallet, labelConfig, userName }: { pallet: PalletData; labelConfig: LabelConfig; userName: string }) {
  const toast = useToast();
  const labels = useStatusLabels();
  const [showAction, setShowAction] = useState(false);
  const [activeAction, setActiveAction] = useState<{ action: string; from: string; to: string; formLabel: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printCount, setPrintCount] = useState(1);

  // Per-action form state
  const [products, setProducts] = useState<{ sku: string; qty: string; lot: string; weight: string }[]>([{ sku: "", qty: "", lot: "", weight: "" }]);
  const [dispatchForm, setDispatchForm] = useState({ truckNumber: "", driverName: "", driverContact: "", destination: "", expectedDelivery: "", notes: "" });
  const [deliverForm, setDeliverForm] = useState({ receiverName: "", receiverContact: "", notes: "" });
  const [pickupForm, setPickupForm] = useState({ pickupDriver: "", condition: "Good", notes: "" });
  const [receiveForm, setReceiveForm] = useState({ inspector: "", condition: "Good", damageDesc: "", notes: "" });
  const [simpleNote, setSimpleNote] = useState("");

  const transitions = getTransitionsFrom(pallet.status as Parameters<typeof getTransitionsFrom>[0]);
  const isLocked = pallet.status === "retired" || pallet.status === "lost";
  const isDamaged = pallet.status === "damaged" || pallet.status === "under_repair";
  const timelineSections = buildTimelineSections(pallet.movements);

  function openAction(t: { action: string; from: string; to: string; formLabel: string }) {
    setActiveAction(t);
    setProducts([{ sku: "", qty: "", lot: "", weight: "" }]);
    setDispatchForm({ truckNumber: "", driverName: "", driverContact: "", destination: "", expectedDelivery: "", notes: "" });
    setDeliverForm({ receiverName: "", receiverContact: "", notes: "" });
    // Phase 3: auto-fill Collector (return pickup) and Inspector (factory receive)
    // with the logged-in user's name — editable, not locked.
    setPickupForm({ pickupDriver: t.action === "return_pickup" ? userName : "", condition: "Good", notes: "" });
    setReceiveForm({ inspector: t.action === "receive_factory" || t.action === "mark_damaged" ? userName : "", condition: "Good", damageDesc: "", notes: "" });
    setSimpleNote("");
    setShowAction(true);
  }

  async function handleAction() {
    if (!activeAction) return;
    setSubmitting(true);
    try {
      // Build payload from the appropriate form state
      let payload: Record<string, unknown> = {};
      const action = activeAction.action;
      if (action === "load") {
        payload = { products: products.filter(p => p.sku || p.qty).map(p => ({ sku: p.sku, qty: Number(p.qty) || 0, lot: p.lot, weight: Number(p.weight) || 0 })) };
      } else if (action === "dispatch") {
        payload = dispatchForm;
      } else if (action === "deliver") {
        payload = deliverForm;
      } else if (action === "return_pickup") {
        payload = pickupForm;
      } else if (action === "receive_factory" || action === "mark_damaged") {
        payload = receiveForm;
      } else {
        payload = simpleNote ? { note: simpleNote } : {};
      }

      // For factory receive, override action based on condition
      const finalAction = (action === "receive_factory" && receiveForm.condition === "Damaged") ? "mark_damaged" : action;

      const res = await fetch("/api/pallets/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palletId: pallet.id, action: finalAction, payload, note: simpleNote || null }),
      });
      if (res.ok) {
        toast.success(`Pallet → ${labels[activeAction.to as PalletStatus] || activeAction.to}`);
        setShowAction(false);
        window.location.reload();
      } else {
        const data = await res.json();
        toast.error(data.error || "Action failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageReveal className="space-y-5">
      <Link
        href="/admin/pallets"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline"
      >
        <ArrowLeft size={16} /> Back to pallets
      </Link>

      <AdminPageHeader
        badge="Pallet 360°"
        title={pallet.palletNumber}
        subtitle={`${pallet.materialType} · ${pallet.dimensions} · ${pallet.tripCount} trips`}
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {transitions.length > 0 && (
              <Button variant="white" onClick={() => openAction(transitions[0])}>
                <ArrowRight size={16} /> Perform action
              </Button>
            )}
            <Button variant="white" onClick={() => { setPrintCount(1); setShowPrintModal(true); }}>
                <Printer size={16} /> Print label
              </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Left column — QR + Info */}
        <div className="space-y-4 xl:col-span-1">
          {/* QR Label */}
          <div className="flex justify-center rounded-[1.35rem] bg-white p-4 shadow-lg ring-1 ring-line">
            <PalletQrLabel
              palletNumber={pallet.palletNumber}
              qrData={pallet.qrCode}
              materialType={pallet.materialType}
              dimensions={pallet.dimensions}
              labelConfig={labelConfig}
            />
          </div>

          {/* Status + Stats card */}
          <div className="premium-card space-y-4 !p-5 ring-1 ring-blue-100/70">
            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATUS_COLORS[pallet.status as keyof typeof STATUS_COLORS] as never || "blue"}>
                {labels[pallet.status as PalletStatus] || pallet.status}
              </Badge>
              <Badge tone="neutral">{pallet.materialType}</Badge>
              {isDamaged && <Badge tone="warn">Damaged</Badge>}
              {isLocked && <Badge tone="danger">Locked</Badge>}
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-blue-50 px-3 py-3 ring-1 ring-blue-100">
                <p className="text-[10px] font-bold uppercase text-muted">Trips</p>
                <p className="font-display text-xl font-bold text-navy-900">
                  {pallet.tripCount}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-100">
                <p className="text-[10px] font-bold uppercase text-muted">Cost</p>
                <p className="font-display text-xl font-bold text-navy-900">
                  OMR {pallet.cost}
                </p>
              </div>
            </div>

            {/* Pallet details */}
            <div className="space-y-3">
              <DetailRow icon={Package} label="QR Code" value={pallet.qrCode.slice(0, 12) + "…"} mono />
              <DetailRow icon={Calendar} label="Manufactured" value={formatDate(pallet.manufactureDate)} />
              <DetailRow icon={Ruler} label="Dimensions" value={pallet.dimensions} />
              <DetailRow icon={Weight} label="Capacity" value={`${pallet.weightCapacity} kg`} />
              <DetailRow icon={MapPin} label="Location" value={pallet.currentLocation || "—" } />
              <DetailRow icon={User} label="Held by" value={pallet.currentUser?.name || "—" } />
              {pallet.returnDueDate && (
                <DetailRow icon={Clock} label="Expected return" value={`${formatDate(pallet.returnDueDate)} · window`} />
              )}
            </div>

            {/* Notes */}
            {pallet.notes && (
              <div className="rounded-xl bg-surface p-3">
                <p className="text-[11px] font-bold uppercase text-muted">Notes</p>
                <p className="mt-1 text-sm text-ink">{pallet.notes}</p>
              </div>
            )}

            {/* Locked warning */}
            {isLocked && (
              <div className="rounded-2xl bg-red-50 px-3 py-3 text-sm font-semibold text-red-900 ring-1 ring-red-100">
                Locked — no further lifecycle actions allowed.
              </div>
            )}

            {/* Current holder card */}
            {pallet.currentUser && (
              <div className="rounded-2xl border border-line bg-surface px-3 py-3">
                <p className="flex items-center gap-1 text-[11px] font-bold uppercase text-muted">
                  <User size={12} /> Current holder
                </p>
                <p className="font-semibold text-ink">{pallet.currentUser.name}</p>
                <p className="text-xs text-muted">{pallet.currentUser.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Timeline + Damage */}
        <div className="space-y-4 xl:col-span-2">
          {/* Movement Timeline */}
          <div className="premium-card !p-5 ring-1 ring-line/80">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <History size={18} />
              </div>
              <div>
                <h2 className="font-display font-bold text-navy-900">
                  Movement Timeline
                </h2>
                <p className="text-xs text-muted">
                  {pallet.movements.length} event{pallet.movements.length !== 1 ? "s" : ""} recorded
                </p>
              </div>
            </div>

            {pallet.movements.length === 0 ? (
              <div className="rounded-xl bg-surface/60 py-8 text-center">
                <History size={24} className="mx-auto text-muted" />
                <p className="mt-2 text-sm text-muted">No movements recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {timelineSections.map((section, sectionIndex) => (
                  <div key={`${section.title}-${sectionIndex}`} className="rounded-2xl border border-blue-100 bg-white/70 p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
                          Lifecycle section {sectionIndex + 1}
                        </p>
                        <p className="text-sm font-bold text-navy-900">{section.title}</p>
                        <p className="text-xs text-muted">{section.description}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                        {section.movements.length} event{section.movements.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <ol className="relative space-y-0 border-l-2 border-blue-100 pl-5">
                      {section.movements.map((m, i) => {
                        const ActionIcon = ACTION_ICONS[m.action] || RefreshCw;
                        const isLatest = i === 0;
                        return (
                          <li key={m.id} className="relative pb-5 last:pb-0">
                            <span
                              className={`absolute -left-[1.4rem] top-1 flex h-5 w-5 items-center justify-center rounded-full text-white shadow ${
                                isLatest
                                  ? "bg-blue-600 ring-2 ring-blue-200"
                                  : "bg-slate-400"
                              }`}
                            >
                              <ActionIcon size={10} />
                            </span>
                            <div className="rounded-xl bg-surface/40 px-3 py-2.5 ring-1 ring-line/50">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold capitalize text-navy-900">
                                  {m.action.replace(/_/g, " ")}
                                </span>
                                {m.fromStatus && m.toStatus && (
                                  <Badge tone="blue">
                                    {labels[m.fromStatus as PalletStatus] || m.fromStatus}
                                    {" → "}
                                    {labels[m.toStatus as PalletStatus] || m.toStatus}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted">
                                {m.user?.name || "System"}
                                {m.user?.role ? ` (${m.user.role.replace(/_/g, " ")})` : ""}
                                {" · "}
                                {formatDateTime(m.createdAt)}
                              </p>
                              {m.note && (
                                <p className="mt-1 text-xs text-slate-600 italic">{m.note}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Damage History */}
          {pallet.damageRecords.length > 0 && (
            <div className="premium-card !p-5 ring-1 ring-line/80">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-navy-900">
                    Damage History
                  </h2>
                  <p className="text-xs text-muted">
                    {pallet.damageRecords.length} record{pallet.damageRecords.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {pallet.damageRecords.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 rounded-xl border border-line bg-surface/60 px-3 py-2.5"
                  >
                    <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${d.resolved ? "text-emerald-500" : "text-red-500"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm text-ink">{d.description}</p>
                        <Badge tone={d.resolved ? "ok" : "danger"}>
                          {d.resolved ? "Resolved" : "Open"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(d.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions — shown when transitions available */}
          {transitions.length > 0 && !isLocked && (
            <div className="premium-card !p-5 ring-1 ring-line/80">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <ArrowRight size={18} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-navy-900">
                    Available Actions
                  </h2>
                  <p className="text-xs text-muted">
                    Transition this pallet to the next state
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {transitions.map((t) => {
                  const Icon = ACTION_ICONS[t.action] || ArrowRight;
                  return (
                    <button
                      key={t.action}
                      onClick={() => openAction(t)}
                      className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy-900">{t.formLabel}</p>
                        <p className="text-[11px] text-muted">
                          {labels[t.from as PalletStatus]} → {labels[t.to as PalletStatus]}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      <Modal
        open={showAction && !!activeAction}
        onClose={() => setShowAction(false)}
        title={activeAction?.formLabel || "Perform Action"}
        subtitle={`${pallet.palletNumber} · ${labels[pallet.status as PalletStatus] || pallet.status}`}
      >
        {activeAction && (
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-900 ring-1 ring-blue-100">
              {labels[activeAction.from as PalletStatus] || activeAction.from}
              {" → "}
              {labels[activeAction.to as PalletStatus] || activeAction.to}
            </div>

            {/* LOAD form */}
            {activeAction.action === "load" && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-muted">Products loaded onto pallet</p>
                {products.map((p, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <input className="input-premium text-xs" placeholder="SKU" value={p.sku}
                      onChange={(e) => { const n = [...products]; n[i] = { ...n[i], sku: e.target.value }; setProducts(n); }} />
                    <input type="number" className="input-premium text-xs" placeholder="Qty" value={p.qty}
                      onChange={(e) => { const n = [...products]; n[i] = { ...n[i], qty: e.target.value }; setProducts(n); }} />
                    <input className="input-premium text-xs" placeholder="Lot" value={p.lot}
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
              </div>
            )}

            {/* DISPATCH form */}
            {activeAction.action === "dispatch" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase text-muted">Truck Number *</label>
                    <input className="input-premium mt-1 text-sm" placeholder="TK-001" value={dispatchForm.truckNumber}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, truckNumber: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-muted">Driver Name *</label>
                    <input className="input-premium mt-1 text-sm" placeholder="Driver name" value={dispatchForm.driverName}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, driverName: e.target.value })} />
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
              </div>
            )}

            {/* DELIVER form */}
            {activeAction.action === "deliver" && (
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
              </div>
            )}

            {/* RETURN PICKUP form */}
            {activeAction.action === "return_pickup" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase text-muted">Collector *</label>
                  <input className="input-premium mt-1 text-sm" placeholder="Collector name" value={pickupForm.pickupDriver}
                    onChange={(e) => setPickupForm({ ...pickupForm, pickupDriver: e.target.value })} />
                  <p className="mt-1 text-[11px] text-muted">Prefilled with your name — edit if a different person is physically collecting.</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted">Condition *</label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {["Good", "Damaged", "Unknown"].map((c) => (
                      <label key={c} className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name="pickup-cond" value={c} checked={pickupForm.condition === c}
                          onChange={() => setPickupForm({ ...pickupForm, condition: c })} className="accent-blue-600" />
                        <span className="text-sm font-semibold">{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FACTORY RECEIVE form */}
            {(activeAction.action === "receive_factory" || activeAction.action === "mark_damaged") && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase text-muted">Inspector Name *</label>
                  <input className="input-premium mt-1 text-sm" placeholder="Inspector name" value={receiveForm.inspector}
                    onChange={(e) => setReceiveForm({ ...receiveForm, inspector: e.target.value })} />
                  <p className="mt-1 text-[11px] text-muted">Prefilled with your name — edit if a different person is inspecting.</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted">Condition *</label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {["Good", "Damaged"].map((c) => (
                      <label key={c} className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name="receive-cond" value={c} checked={receiveForm.condition === c}
                          onChange={() => setReceiveForm({ ...receiveForm, condition: c })} className="accent-blue-600" />
                        <span className={`text-sm font-semibold ${c === "Damaged" ? "text-red-700" : "text-emerald-700"}`}>{c}</span>
                      </label>
                    ))}
                  </div>
                  {receiveForm.condition === "Good" && <p className="mt-1 text-xs text-emerald-700">→ Returns to Available, trip +1</p>}
                  {receiveForm.condition === "Damaged" && <p className="mt-1 text-xs text-red-700">→ Flagged as Damaged</p>}
                </div>
                {receiveForm.condition === "Damaged" && (
                  <div>
                    <label className="text-xs font-bold uppercase text-muted">Damage Description *</label>
                    <textarea className="input-premium mt-1 text-sm" rows={3} placeholder="Describe the damage…"
                      value={receiveForm.damageDesc} onChange={(e) => setReceiveForm({ ...receiveForm, damageDesc: e.target.value })} />
                  </div>
                )}
              </div>
            )}

            {/* Note for simple actions (begin_repair, complete_repair, retire, mark_lost, admin_override) */}
            {!["load", "dispatch", "deliver", "return_pickup", "receive_factory", "mark_damaged"].includes(activeAction.action) && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted">Justification / Note</label>
                <textarea className="input-premium mt-1 text-sm" rows={3} placeholder="Required for admin actions…"
                  value={simpleNote} onChange={(e) => setSimpleNote(e.target.value)} />
              </div>
            )}

            {/* Extra note for all actions */}
            {["load", "dispatch", "deliver", "return_pickup"].includes(activeAction.action) && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted">Notes (optional)</label>
                <input className="input-premium mt-1 text-sm" placeholder="Optional note"
                  value={simpleNote} onChange={(e) => setSimpleNote(e.target.value)} />
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="secondary" fullWidth onClick={() => setShowAction(false)}>Cancel</Button>
              <Button fullWidth disabled={submitting} onClick={handleAction}>
                {submitting ? <><Loader2 size={15} className="animate-spin" /> Processing…</> : activeAction.formLabel}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Print label modal */}
      <Modal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Print QR Label"
        subtitle={pallet.palletNumber}
        size="sm"
      >
        <div className="space-y-4">
          {/* Print preview */}
          <div className="print-sheet rounded-2xl bg-slate-100/80 p-4 ring-1 ring-line">
            <div className="print-grid grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: printCount }).map((_, i) => (
                <div key={i} className="print-label flex justify-center">
                  <PalletQrLabel
                    palletNumber={pallet.palletNumber}
                    qrData={pallet.qrCode}
                    materialType={pallet.materialType}
                    dimensions={pallet.dimensions}
                    labelConfig={labelConfig}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Quantity selector */}
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm font-bold text-slate-700">Labels:</span>
            <button
              onClick={() => setPrintCount(Math.max(1, printCount - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              -
            </button>
            <span className="w-8 text-center font-mono text-lg font-bold text-navy-900">{printCount}</span>
            <button
              onClick={() => setPrintCount(Math.min(12, printCount + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              +
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {[1, 2, 4, 6, 8].map((n) => (
              <button
                key={n}
                onClick={() => setPrintCount(n)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  printCount === n
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" fullWidth onClick={() => setShowPrintModal(false)}>
              Cancel
            </Button>
            <Button fullWidth onClick={() => { window.print(); setShowPrintModal(false); }}>
              <Printer size={16} /> Print {printCount} label{printCount > 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </Modal>
    </PageReveal>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="shrink-0 text-muted" />
      <span className="w-24 shrink-0 text-[11px] font-bold uppercase text-muted">{label}</span>
      <span className={`min-w-0 break-words text-sm text-ink ${mono ? "mono-code" : ""}`}>{value}</span>
    </div>
  );
}

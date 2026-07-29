"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { PalletQrLabel } from "@/components/admin/PalletQrLabel";
import type { LabelConfig } from "@/lib/label-settings";
import {
  Package,
  ArrowRight,
  CheckCircle2,
  Printer,
  Minus,
  Plus,
  Loader2,
} from "lucide-react";

export function RegisterPalletClient({
  labelConfig,
  materialTypes = ["plastic", "wood", "metal", "composite"],
}: {
  labelConfig: LabelConfig;
  materialTypes?: string[];
}) {
  const toast = useToast();
  const [palletForm, setPalletForm] = useState({
    palletNumber: "",
    manufactureDate: "",
    materialType: materialTypes[0] ?? "plastic",
    dimensions: "",
    weightCapacity: "",
    cost: "",
    notes: "",
  });
  const [registeredPallet, setRegisteredPallet] = useState<{
    palletNumber: string;
    materialType: string;
    dimensions: string;
  } | null>(null);
  const [printCount, setPrintCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/pallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palletNumber: palletForm.palletNumber || undefined,
          manufactureDate: palletForm.manufactureDate || new Date().toISOString(),
          materialType: palletForm.materialType,
          dimensions: palletForm.dimensions || "1200×800×150mm",
          weightCapacity: palletForm.weightCapacity || 500,
          cost: palletForm.cost || 0,
          notes: palletForm.notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRegisteredPallet({
          palletNumber: data.pallet.palletNumber,
          materialType: palletForm.materialType,
          dimensions: palletForm.dimensions || "1200×800×150mm",
        });
        toast.success(`Pallet ${data.pallet.palletNumber} registered!`);
        setPalletForm({
          palletNumber: "",
          manufactureDate: "",
          materialType: materialTypes[0] ?? "plastic",
          dimensions: "",
          weightCapacity: "",
          cost: "",
          notes: "",
        });
      } else {
        const data = await res.json();
        toast.error(data.error || "Registration failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageReveal className="space-y-6">
      {/* Hero */}
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-navy-950 via-emerald-900 to-teal-700 p-5 text-white shadow-xl sm:p-6">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <motion.div
            className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl"
            animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="relative z-10">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100 backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
            </span>
            Manufacturing
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Register New Pallet
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-emerald-50/90">
            Create a permanent digital record for a new pallet. A unique QR code will be generated for printing.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        {registeredPallet ? (
          /* ── Success + Print Preview ── */
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-5"
          >
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center sm:p-6">
              <CheckCircle2 size={52} className="mx-auto text-emerald-500" />
              <h2 className="mt-3 font-display text-xl font-bold text-emerald-900">
                {registeredPallet.palletNumber}
              </h2>
              <p className="mt-1 text-sm text-emerald-700">
                Registered successfully · QR code ready to print
              </p>
            </div>

            {/* Print preview */}
            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="print-hide text-xs font-bold uppercase tracking-wide text-muted">
                  Print preview — {printCount} label{printCount === 1 ? "" : "s"}
                </p>
                <div className="print-hide flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Qty:</span>
                  <button
                    onClick={() => setPrintCount(Math.max(1, printCount - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-7 text-center font-mono text-sm font-bold text-navy-900">
                    {printCount}
                  </span>
                  <button
                    onClick={() => setPrintCount(Math.min(20, printCount + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* Quick qty */}
              <div className="print-hide mb-4 flex flex-wrap gap-2">
                {[1, 2, 4, 6, 8, 12, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPrintCount(n)}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                      printCount === n
                        ? "bg-emerald-600 text-white shadow-md"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div className="print-sheet print-grid grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {Array.from({ length: printCount }).map((_, i) => (
                  <div key={i} className="print-label flex justify-center">
                    <PalletQrLabel
                      palletNumber={registeredPallet.palletNumber}
                      materialType={registeredPallet.materialType}
                      dimensions={registeredPallet.dimensions}
                      labelConfig={labelConfig}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <div className="print-hide flex flex-col gap-3 sm:flex-row">
              <Button fullWidth onClick={() => window.print()} className="!min-h-[48px]">
                <Printer size={16} /> Print {printCount} label{printCount === 1 ? "" : "s"}
              </Button>
              <Button
                fullWidth
                variant="secondary"
                className="!min-h-[48px]"
                onClick={() => { setRegisteredPallet(null); setPrintCount(1); }}
              >
                <Package size={16} /> Register another
              </Button>
            </div>
          </motion.div>
        ) : (
          /* ── Registration Form ── */
          <Card>
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Package size={18} />
              </div>
              <div>
                <h2 className="font-display font-bold text-navy-900">Pallet Details</h2>
                <p className="text-xs text-muted">All fields except Pallet # are required</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted">
                    Pallet # <span className="font-normal text-slate-400">(optional — auto-generated)</span>
                  </label>
                  <input
                    className="input-premium mt-1 text-sm"
                    placeholder="e.g. PT-0001"
                    value={palletForm.palletNumber}
                    onChange={(e) => setPalletForm({ ...palletForm, palletNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted">
                    Manufacture Date *
                  </label>
                  <input
                    type="date"
                    className="input-premium mt-1 text-sm"
                    value={palletForm.manufactureDate}
                    onChange={(e) => setPalletForm({ ...palletForm, manufactureDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted">
                  Material Type *
                </label>
                <select
                  className="input-premium mt-1 text-sm"
                  value={palletForm.materialType}
                  onChange={(e) => setPalletForm({ ...palletForm, materialType: e.target.value })}
                >
                  {materialTypes.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted">
                    Dimensions *
                  </label>
                  <input
                    className="input-premium mt-1 text-sm"
                    placeholder="1200×800×150mm"
                    value={palletForm.dimensions}
                    onChange={(e) => setPalletForm({ ...palletForm, dimensions: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted">
                    Weight Capacity (kg) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input-premium mt-1 text-sm"
                    placeholder="500"
                    value={palletForm.weightCapacity}
                    onChange={(e) => setPalletForm({ ...palletForm, weightCapacity: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted">
                  Cost (OMR) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className="input-premium mt-1 text-sm"
                  placeholder="25.000"
                  value={palletForm.cost}
                  onChange={(e) => setPalletForm({ ...palletForm, cost: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted">
                  Notes
                </label>
                <textarea
                  className="input-premium mt-1 text-sm"
                  rows={2}
                  placeholder="Batch notes, supplier info, etc."
                  value={palletForm.notes}
                  onChange={(e) => setPalletForm({ ...palletForm, notes: e.target.value })}
                />
              </div>

              <Button
                fullWidth
                className="!min-h-[52px]"
                disabled={submitting}
                onClick={handleRegister}
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Registering…</>
                ) : (
                  <>Register pallet &amp; generate QR <ArrowRight size={16} /></>
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </PageReveal>
  );
}

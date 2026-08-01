"use client";

import { useState } from "react";
import { PageReveal } from "@/components/motion/PageReveal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  Settings, Loader2, Tag, RotateCcw, AlertCircle,
  Package, Plus, X, CheckCircle2, Database, Trash2, FlaskConical, ShieldAlert,
  Tags, RefreshCcw, Save,
} from "lucide-react";
import type { LabelConfig } from "@/lib/label-settings";
import type { PalletStatus } from "@prisma/client";
import { STATUS_LABELS as DEFAULT_STATUS_LABELS } from "@/lib/pallet-machine";
import { STATUS_LABEL_KEYS, ALL_STATUSES } from "@/lib/status-labels";

const DEFAULT_MATERIAL_TYPES = ["plastic", "wood", "metal", "composite"];

function SettingRow({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:gap-6 border-b border-line last:border-0">
      <div className="flex shrink-0 items-center gap-3 sm:w-56">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold text-navy-900">{label}</p>
          <p className="text-xs text-muted leading-snug">{description}</p>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-1 flex items-center gap-3 border-b border-line pb-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        {icon}
      </div>
      <div>
        <h2 className="font-display text-base font-bold text-navy-900">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

export function SettingsPageClient({
  returnWindow,
  lowInventoryThreshold,
  labelConfig,
  initialMaterialTypes,
  initialStatusLabels,
}: {
  returnWindow: string;
  lowInventoryThreshold: string;
  labelConfig: LabelConfig;
  initialMaterialTypes: string[];
  initialStatusLabels: Record<PalletStatus, string>;
}) {
  const toast = useToast();

  // Operational
  const [retDays, setRetDays] = useState(returnWindow);
  const [lowInv, setLowInv] = useState(lowInventoryThreshold);
  const [saving, setSaving] = useState(false);

  // Label branding
  const [companyName, setCompanyName] = useState(labelConfig.companyName);
  const [tagline, setTagline] = useState(labelConfig.tagline);
  const [accentColor, setAccentColor] = useState(labelConfig.accentColor);
  const [footerText, setFooterText] = useState(labelConfig.footerText);
  const [savingLabel, setSavingLabel] = useState(false);

  // Material types (persisted to DB)
  const [materialTypes, setMaterialTypes] = useState<string[]>(initialMaterialTypes);
  const [newMaterial, setNewMaterial] = useState("");
  const [savingMaterials, setSavingMaterials] = useState(false);

  // Status labels (persisted to DB)
  const [statusLabels, setStatusLabels] = useState<Record<PalletStatus, string>>(initialStatusLabels);
  const [savingStatusLabels, setSavingStatusLabels] = useState(false);

  async function handleSaveStatusLabels() {
    const trimmed: Record<string, string> = {};
    for (const status of ALL_STATUSES) {
      const v = (statusLabels[status] || "").trim();
      if (!v) { toast.error(`Label for "${STATUS_LABEL_KEYS[status]}" cannot be empty`); return; }
      trimmed[status] = v;
    }
    setSavingStatusLabels(true);
    try {
      const res = await fetch("/api/settings/status-labels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labels: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Status labels saved — visible across all pallet screens");
        setStatusLabels({ ...initialStatusLabels, ...data.labels });
      } else {
        toast.error(data.error || "Failed to save status labels");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingStatusLabels(false);
    }
  }

  async function handleResetStatusLabels() {
    const defaults: Record<string, string> = {};
    for (const status of ALL_STATUSES) defaults[status] = DEFAULT_STATUS_LABELS[status];
    setStatusLabels({ ...DEFAULT_STATUS_LABELS });
    setSavingStatusLabels(true);
    try {
      const res = await fetch("/api/settings/status-labels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labels: defaults }),
      });
      const data = await res.json();
      if (res.ok) toast.success("Status labels reset to defaults");
      else toast.error(data.error || "Failed to reset status labels");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingStatusLabels(false);
    }
  }

  // DB management
  const [dbAction, setDbAction] = useState<"clear_pallets" | "seed_pallets" | "clear_audit" | null>(null);
  const [dbConfirmText, setDbConfirmText] = useState("");
  const [dbRunning, setDbRunning] = useState(false);
  const [dbResult, setDbResult] = useState<string | null>(null);

  async function handleDbAction() {
    if (!dbAction) return;
    setDbRunning(true);
    setDbResult(null);
    try {
      const res = await fetch("/api/admin/db-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: dbAction }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Done");
        setDbResult(data.message || "Done");
      } else {
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDbRunning(false);
      setDbAction(null);
      setDbConfirmText("");
    }
  }

  async function handleSaveOperational() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          return_window_days: retDays,
          low_inventory_threshold: lowInv,
        }),
      });
      const data = await res.json();
      if (res.ok) toast.success("Operational settings saved");
      else toast.error(data.error || "Failed to save");
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLabel() {
    setSavingLabel(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label_company_name: companyName,
          label_company_tagline: tagline,
          label_accent_color: accentColor,
          label_footer_text: footerText,
        }),
      });
      const data = await res.json();
      if (res.ok) toast.success("Label branding saved");
      else toast.error(data.error || "Failed to save label settings");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingLabel(false);
    }
  }

  async function addMaterialType() {
    const trimmed = newMaterial.trim().toLowerCase();
    if (!trimmed) return;
    if (materialTypes.includes(trimmed)) { toast.error("Already exists"); return; }
    const next = [...materialTypes, trimmed];
    setMaterialTypes(next);
    setNewMaterial("");
    // Auto-save immediately so Register Pallet sees it right away
    setSavingMaterials(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material_types: next }),
      });
      const data = await res.json();
      if (res.ok) toast.success(`"${trimmed}" added and saved`);
      else toast.error(data.error || "Failed to save");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingMaterials(false);
    }
  }

  function removeMaterialType(t: string) {
    if (DEFAULT_MATERIAL_TYPES.includes(t) && materialTypes.filter(m => !DEFAULT_MATERIAL_TYPES.includes(m)).length === 0 && materialTypes.length <= 1) {
      toast.error("Must keep at least one type"); return;
    }
    setMaterialTypes(materialTypes.filter((m) => m !== t));
  }

  async function handleSaveMaterials() {
    setSavingMaterials(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material_types: materialTypes }),
      });
      const data = await res.json();
      if (res.ok) toast.success("Material types saved");
      else toast.error(data.error || "Failed to save");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingMaterials(false);
    }
  }

  return (
    <PageReveal className="space-y-6">
      {/* Hero */}
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#050b16] via-slate-900 to-blue-950 p-5 text-white shadow-xl sm:p-6">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">System Settings</h1>
            <p className="mt-1.5 max-w-lg text-sm text-blue-50/80">
              Configure operational thresholds, pallet label branding, and material types.
            </p>
          </div>
          <Settings size={36} className="shrink-0 text-white/15" />
        </div>
      </div>

      {/* ── SECTION 1: Operational ── */}
      <div className="premium-card !p-4 sm:!p-6">
        <SectionHeader
          icon={<RotateCcw size={18} />}
          title="Operational Rules"
          subtitle="Return windows and inventory alert thresholds"
        />
        <div className="divide-y divide-line">
          <SettingRow
            icon={<RotateCcw size={16} />}
            label="Return window"
            description="Days until a delivered pallet is overdue"
          >
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min="1"
                max="365"
                className="input-premium w-24 text-center text-sm font-mono font-bold"
                value={retDays}
                onChange={(e) => setRetDays(e.target.value)}
              />
              <span className="text-sm text-muted">days &nbsp;(default: 14)</span>
            </div>
          </SettingRow>

          <SettingRow
            icon={<AlertCircle size={16} />}
            label="Low inventory alert"
            description="Alert when available pallets fall below this"
          >
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min="1"
                max="10000"
                className="input-premium w-24 text-center text-sm font-mono font-bold"
                value={lowInv}
                onChange={(e) => setLowInv(e.target.value)}
              />
              <span className="text-sm text-muted">pallets &nbsp;(default: 50)</span>
            </div>
          </SettingRow>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={handleSaveOperational} disabled={saving} className="!min-h-[42px] !px-6">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving&hellip;</> : <><CheckCircle2 size={14} /> Save operational settings</>}
          </Button>
        </div>
      </div>

      {/* ── SECTION 2: Pallet Material Types ── */}
      <div className="premium-card !p-4 sm:!p-6">
        <SectionHeader
          icon={<Package size={18} />}
          title="Pallet Material Types"
          subtitle="Shown in the Register Pallet dropdown — saved to database"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {materialTypes.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-bold capitalize text-navy-900"
            >
              {t}
              <button
                onClick={() => removeMaterialType(t)}
                className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors"
                title="Remove"
                disabled={materialTypes.length <= 1}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-4 flex max-w-xs gap-2">
          <input
            className="input-premium flex-1 text-sm"
            placeholder="e.g. aluminium"
            value={newMaterial}
            onChange={(e) => setNewMaterial(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMaterialType()}
          />
          <Button variant="secondary" className="!min-h-[42px] !px-3" onClick={addMaterialType} disabled={!newMaterial.trim()}>
            <Plus size={15} />
          </Button>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={handleSaveMaterials} disabled={savingMaterials} className="!min-h-[42px] !px-6">
            {savingMaterials ? <><Loader2 size={14} className="animate-spin" /> Saving&hellip;</> : <><CheckCircle2 size={14} /> Save material types</>}
          </Button>
        </div>
      </div>

      {/* ── SECTION 3: Label & Branding ── */}
      <div className="premium-card !p-4 sm:!p-6">
        <SectionHeader
          icon={<Tag size={18} />}
          title="Label &amp; Branding"
          subtitle="Customize the text and colour on printed pallet QR labels"
        />
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted">Company Name</label>
            <input
              className="input-premium mt-1.5 text-sm"
              maxLength={60}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="PalletTrack Pro"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted">Tagline</label>
            <input
              className="input-premium mt-1.5 text-sm"
              maxLength={60}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Returnable Pallet"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted">Accent Colour</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-10 cursor-pointer rounded-xl border border-line bg-white p-0.5 shadow-sm"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
              />
              <input
                className="input-premium flex-1 text-sm font-mono"
                maxLength={7}
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#1e40af"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted">Footer Text</label>
            <input
              className="input-premium mt-1.5 text-sm"
              maxLength={80}
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Scan to track &middot; do not remove"
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-5 rounded-2xl border border-line bg-slate-50 p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted">Label preview</p>
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-white text-xs font-black text-center leading-tight"
              style={{ backgroundColor: accentColor }}
            >
              QR
            </div>
            <div className="min-w-0">
              <p className="break-words font-bold text-sm" style={{ color: accentColor }}>
                {companyName || "Company Name"}
              </p>
              <p className="break-words text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {tagline || "Tagline"}
              </p>
              <p className="mt-1 font-mono text-[11px] font-bold text-slate-800">PT-XXXXXX</p>
              <p className="mt-0.5 break-words text-[9px] uppercase tracking-widest text-slate-400">
                {footerText || "footer text"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={handleSaveLabel} disabled={savingLabel} className="!min-h-[42px] !px-6">
            {savingLabel ? <><Loader2 size={14} className="animate-spin" /> Saving&hellip;</> : <><Tag size={14} /> Save label branding</>}
          </Button>
        </div>
      </div>

      {/* ── SECTION 3.5: Status Labels ── */}
      <div className="premium-card !p-4 sm:!p-6">
        <SectionHeader
          icon={<Tags size={18} />}
          title="Status Labels"
          subtitle="Rename how pallet statuses appear across every screen (client terminology)"
        />
        <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-900">
          These labels replace the default names everywhere a pallet status is shown — Scan,
          Pallets, Pallet Profile, Command Center, Dashboard, Dispatch and Reports. Internal
          status identifiers stay unchanged, so reports, filters and the audit trail keep working.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ALL_STATUSES.map((status) => (
            <div key={status} className="rounded-xl border border-line bg-surface p-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
                {STATUS_LABEL_KEYS[status].replace("status_label_", "").replace(/_/g, " ")}
              </label>
              <input
                className="input-premium mt-1.5 w-full text-sm font-semibold"
                maxLength={40}
                value={statusLabels[status]}
                onChange={(e) => setStatusLabels({ ...statusLabels, [status]: e.target.value })}
                placeholder={DEFAULT_STATUS_LABELS[status]}
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleResetStatusLabels}
            disabled={savingStatusLabels}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw size={13} /> Reset to defaults
          </button>
          <Button onClick={handleSaveStatusLabels} disabled={savingStatusLabels} className="!min-h-[42px] !px-6">
            {savingStatusLabels ? <><Loader2 size={14} className="animate-spin" /> Saving&hellip;</> : <><Save size={14} /> Save status labels</>}
          </Button>
        </div>
      </div>

      {/* ── SECTION 4: Database & Testing ── */}
      <div className="premium-card !p-4 sm:!p-6">
        <SectionHeader
          icon={<Database size={18} />}
          title="Database &amp; Testing"
          subtitle="Clear test data or seed demo pallets for training and QA workflows"
        />
        <div className="mt-4 space-y-3">
          {/* Seed demo pallets */}
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><FlaskConical size={16} /></div>
              <div>
                <p className="text-sm font-bold text-emerald-900">Seed Demo Pallets</p>
                <p className="text-xs text-emerald-700 mt-0.5">Creates 10 sample pallets across all statuses (Available, Loaded, In Transit, Delivered, Returning, Damaged) so you can walk through the full flow with trainees.</p>
              </div>
            </div>
            <button
              onClick={() => { setDbAction("seed_pallets"); setDbConfirmText(""); setDbResult(null); }}
               className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition sm:w-auto">
              <FlaskConical size={13} /> Seed Demo Data
            </button>
          </div>

          {/* Clear pallets */}
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700"><Trash2 size={16} /></div>
              <div>
                <p className="text-sm font-bold text-red-900">Clear All Pallet Data</p>
                <p className="text-xs text-red-700 mt-0.5">Deletes all pallets, movements, and damage records. Users and settings are kept. Use this to reset after a training session.</p>
              </div>
            </div>
            <button
              onClick={() => { setDbAction("clear_pallets"); setDbConfirmText(""); setDbResult(null); }}
               className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition sm:w-auto">
              <Trash2 size={13} /> Clear Pallets
            </button>
          </div>

          {/* Clear audit log */}
          <div className="flex flex-col gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><RotateCcw size={16} /></div>
              <div>
                <p className="text-sm font-bold text-orange-900">Clear Audit Log</p>
                <p className="text-xs text-orange-700 mt-0.5">Removes all audit trail entries. Useful to start fresh before a client demo. Does not affect pallets or users.</p>
              </div>
            </div>
            <button
              onClick={() => { setDbAction("clear_audit"); setDbConfirmText(""); setDbResult(null); }}
               className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 transition sm:w-auto">
              <RotateCcw size={13} /> Clear Audit Log
            </button>
          </div>

          {dbResult && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 size={14} /> {dbResult}
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm Dialog ── */}
      {dbAction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-navy-950/60 p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <ShieldAlert size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-bold text-navy-900">
                  {dbAction === "seed_pallets" ? "Seed Demo Pallets" :
                   dbAction === "clear_pallets" ? "Clear All Pallet Data" : "Clear Audit Log"}
                </p>
                <p className="text-xs text-muted">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-4">
              {dbAction === "seed_pallets"
                ? 'Type <strong>SEED</strong> to create demo pallets for training.'
                : dbAction === "clear_pallets"
                ? 'Type <strong>DELETE</strong> to permanently remove all pallets and their history.'
                : 'Type <strong>CLEAR</strong> to wipe the audit log.'}
            </p>
            <input
              className="input-premium w-full font-mono text-sm mb-4"
              placeholder={dbAction === "seed_pallets" ? "SEED" : dbAction === "clear_pallets" ? "DELETE" : "CLEAR"}
              value={dbConfirmText}
              onChange={e => setDbConfirmText(e.target.value.toUpperCase())}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button onClick={() => { setDbAction(null); setDbConfirmText(""); }}
                className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                disabled={dbRunning ||
                  (dbAction === "seed_pallets" && dbConfirmText !== "SEED") ||
                  (dbAction === "clear_pallets" && dbConfirmText !== "DELETE") ||
                  (dbAction === "clear_audit" && dbConfirmText !== "CLEAR")}
                onClick={handleDbAction}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-40 ${
                  dbAction === "seed_pallets" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                }`}>
                {dbRunning ? <><Loader2 size={14} className="animate-spin" /> Running…</> : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 5: Coming Soon ── */}
      <div className="premium-card !p-4 opacity-60 pointer-events-none select-none sm:!p-6">
        <SectionHeader
          icon={<Settings size={18} />}
          title="Email Notifications"
          subtitle="Configure SMTP and notification preferences"
        />
        <div className="mt-3 rounded-xl border border-dashed border-line bg-slate-50 py-6 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Coming in a future release</p>
        </div>
      </div>
    </PageReveal>
  );
}


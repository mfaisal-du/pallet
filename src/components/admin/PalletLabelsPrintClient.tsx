"use client";

import { useState, useMemo } from "react";
import { PageReveal } from "@/components/motion/PageReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PalletQrLabel } from "@/components/admin/PalletQrLabel";
import { formatDate } from "@/lib/format-date";
import type { LabelConfig } from "@/lib/label-settings";
import {
  CheckSquare,
  ChevronDown,
  Printer,
  Search,
  Square,
  X,
} from "lucide-react";

type Pallet = {
  id: string;
  palletNumber: string;
  materialType: string;
  dimensions: string;
  printedAt: string | null;
  createdAt: string;
};

const MATERIAL_TYPES = ["plastic", "wood", "metal", "composite"];

export function PalletLabelsPrintClient({
  initialPallets,
  labelConfig,
}: {
  initialPallets: Pallet[];
  labelConfig: LabelConfig;
}) {
  const toast = useToast();
  const [pallets] = useState<Pallet[]>(initialPallets);
  const [search, setSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState<string>("all");
  const [unprintedOnly, setUnprintedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialPallets.filter((p) => !p.printedAt).map((p) => p.id))
  );
  const [printing, setPrinting] = useState(false);

  const filtered = useMemo(() => {
    let result = pallets;
    if (unprintedOnly) result = result.filter((p) => !p.printedAt);
    if (materialFilter !== "all") result = result.filter((p) => p.materialType === materialFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.palletNumber.toLowerCase().includes(q) || p.materialType.toLowerCase().includes(q));
    }
    return result;
  }, [pallets, unprintedOnly, materialFilter, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Pallet[]> = {};
    for (const p of filtered) {
      const key = p.materialType;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  }, [filtered]);

  const selectedPallets = useMemo(() => pallets.filter((p) => selectedIds.has(p.id)), [pallets, selectedIds]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(material: string) {
    const groupPallets = grouped[material] || [];
    const allSelected = groupPallets.every((p) => selectedIds.has(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of groupPallets) {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map((p) => p.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handlePrint() {
    if (selectedIds.size === 0) return;
    setPrinting(true);
    try {
      const res = await fetch("/api/pallets/mark-printed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palletIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        toast.success(`Marked ${selectedIds.size} label${selectedIds.size > 1 ? "s" : ""} as printed`);
      }
    } catch {
      toast.error("Failed to mark as printed");
    }
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 200);
  }

  return (
    <PageReveal className="space-y-6">
      <AdminPageHeader
        title="Print QR Labels"
        subtitle={`${pallets.length} pallets · ${pallets.filter((p) => !p.printedAt).length} unprinted · ${selectedIds.size} selected`}
        badge="print shop"
        actions={
          <Button
            variant="white"
            className="w-full sm:w-auto"
            disabled={selectedIds.size === 0 || printing}
            onClick={handlePrint}
          >
            <Printer size={16} />
            {printing ? "Printing…" : `Print ${selectedIds.size || ""} label${selectedIds.size !== 1 ? "s" : ""}`}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 basis-full sm:min-w-[200px] sm:max-w-md sm:flex-1">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              placeholder="Search pallets…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted hover:text-ink">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setUnprintedOnly(!unprintedOnly)}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
            unprintedOnly
              ? "bg-amber-500 text-white shadow-md"
              : "bg-white text-muted ring-1 ring-line hover:bg-surface"
          }`}
        >
          Unprinted only
        </button>

        <button
          onClick={selectAll}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-muted ring-1 ring-line hover:bg-surface"
        >
          Select all
        </button>
        {selectedIds.size > 0 && (
          <button
            onClick={deselectAll}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-muted ring-1 ring-line hover:bg-surface"
          >
            Clear ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Material filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMaterialFilter("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
            materialFilter === "all"
              ? "bg-blue-700 text-white shadow-md"
              : "bg-white text-muted ring-1 ring-line hover:bg-surface"
          }`}
        >
          All ({pallets.length})
        </button>
        {MATERIAL_TYPES.map((m) => {
          const count = pallets.filter((p) => p.materialType === m).length;
          if (count === 0) return null;
          return (
            <button
              key={m}
              onClick={() => setMaterialFilter(m)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${
                materialFilter === m
                  ? "bg-blue-700 text-white shadow-md"
                  : "bg-white text-muted ring-1 ring-line hover:bg-surface"
              }`}
            >
              {m} ({count})
            </button>
          );
        })}
      </div>

      {/* Grouped pallet selection */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([material, groupPallets]) => {
          const allSelected = groupPallets.every((p) => selectedIds.has(p.id));
          const someSelected = groupPallets.some((p) => selectedIds.has(p.id));
          const selectedInGroup = groupPallets.filter((p) => selectedIds.has(p.id)).length;

          return (
            <div key={material} className="rounded-2xl border border-line bg-white">
              <button
                onClick={() => toggleGroup(material)}
                className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left sm:gap-3"
              >
                {allSelected ? (
                  <CheckSquare size={16} className="text-blue-600" />
                ) : someSelected ? (
                  <div className="flex h-4 w-4 items-center justify-center rounded border border-blue-600 bg-blue-600">
                    <div className="h-1.5 w-1.5 rounded-sm bg-white" />
                  </div>
                ) : (
                  <Square size={16} className="text-slate-300" />
                )}
                <span className="font-display text-sm font-bold capitalize text-navy-900">{material}</span>
                <Badge tone="blue">{groupPallets.length}</Badge>
                {someSelected && (
                  <span className="text-xs font-bold text-blue-600">{selectedInGroup} selected</span>
                )}
                <ChevronDown size={14} className="ml-auto text-muted" />
              </button>

              <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {groupPallets.map((p) => {
                  const selected = selectedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      className={`relative rounded-xl border-2 p-2 text-center transition ${
                        selected
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      {selected && (
                        <div className="absolute right-1.5 top-1.5">
                          <CheckSquare size={14} className="text-blue-600" />
                        </div>
                      )}
                      <p className="mono-code text-[11px] font-bold text-navy-900">{p.palletNumber}</p>
                      <p className="text-[10px] text-muted">{formatDate(p.createdAt)}</p>
                      {!p.printedAt && (
                        <Badge tone="warn">new</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {Object.keys(grouped).length === 0 && (
          <div className="rounded-2xl border border-line bg-white py-12 text-center text-sm text-muted">
            No pallets match the current filters.
          </div>
        )}
      </div>

      {/* Print preview — visible on screen AND in print */}
      {selectedPallets.length > 0 && (
        <div className="print-sheet rounded-2xl bg-slate-100/80 p-4 ring-1 ring-line">
          <p className="print-hide mb-3 text-xs font-bold uppercase tracking-wide text-muted">
            Print preview — {selectedPallets.length} label{selectedPallets.length === 1 ? "" : "s"}
          </p>
          <div className="print-grid grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {selectedPallets.map((p) => (
              <div key={p.id} className="print-label flex justify-center">
                <PalletQrLabel
                  palletNumber={p.palletNumber}
                  materialType={p.materialType}
                  dimensions={p.dimensions}
                  labelConfig={labelConfig}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPallets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-white py-12 text-center">
          <Printer size={32} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-muted">
            Select pallets above to preview labels for printing.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Unprinted pallets are auto-selected on first load.
          </p>
        </div>
      )}
    </PageReveal>
  );
}

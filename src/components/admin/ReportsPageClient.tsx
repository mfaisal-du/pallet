"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { BarChart3, Download, Loader2, X, ChevronRight } from "lucide-react";

type ReportResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  summary?: Record<string, unknown>;
};

const REPORTS = [
  { id: 1, name: "Daily Pallet Movement", desc: "All pallet movements with status transitions", icon: "📦" },
  { id: 2, name: "Weekly Summary", desc: "Movement counts grouped by week", icon: "📅" },
  { id: 3, name: "Monthly Summary", desc: "Aggregated movements and trends by month", icon: "📊" },
  { id: 4, name: "Customer Pallet Report", desc: "Pallets currently held at each customer location", icon: "🏢" },
  { id: 5, name: "Driver Performance", desc: "Dispatches and deliveries by driver", icon: "🚛" },
  { id: 6, name: "Warehouse Activity", desc: "Loading and receiving operations by user", icon: "🏭" },
  { id: 7, name: "Overdue Pallets", desc: "Pallets past their return-due date", icon: "⚠️" },
  { id: 8, name: "Damaged Pallets", desc: "All damage records with descriptions", icon: "🔧" },
  { id: 9, name: "Lost Pallets", desc: "Pallets marked as lost with last known location", icon: "❓" },
  { id: 10, name: "Inventory Snapshot", desc: "Full pallet inventory across all statuses", icon: "📋" },
  { id: 11, name: "Pallet Utilization", desc: "Trip counts and utilization rate per pallet", icon: "🔄" },
  { id: 12, name: "Return Performance", desc: "On-time return rates by customer", icon: "✅" },
];

export function ReportsPageClient({ initialPalletCount }: { initialPalletCount: number }) {
  const toast = useToast();
  const [activeReport, setActiveReport] = useState<number | null>(null);
  const [loadingReportId, setLoadingReportId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [activeReportName, setActiveReportName] = useState("");

  async function runReport(reportId: number) {
    setLoading(true);
    setLoadingReportId(reportId);
    setResult(null);
    const rpt = REPORTS.find((r) => r.id === reportId);
    setActiveReportName(rpt?.name ?? "");
    const params = new URLSearchParams({ type: String(reportId) });
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    try {
      const res = await fetch(`/api/reports?${params}`);
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setActiveReport(reportId);
      } else {
        toast.error(data.error || "Failed to generate report");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
      setLoadingReportId(null);
    }
  }

  function handleExportCSV() {
    if (!result) return;
    const csv = [
      result.columns.join(","),
      ...result.rows.map((row) =>
        result.columns.map((c) => {
          const val = row[c];
          const str = String(val ?? "");
          return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeReportName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  }

  return (
    <PageReveal className="space-y-6">
      {/* Hero */}
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-navy-950 via-blue-900 to-blue-700 p-5 text-white shadow-xl sm:p-6">
        <div className="relative z-10">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-100">
            <BarChart3 size={10} /> 12 Reports
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
          <p className="mt-1.5 max-w-xl text-sm text-blue-50/90">
            Operational reports · {initialPalletCount} pallets in system
          </p>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex flex-col items-stretch gap-3 premium-card !p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-xs font-bold uppercase text-muted">Date Range:</span>
        <div className="grid grid-cols-[auto_1fr] items-center gap-2 sm:flex">
          <label className="text-xs text-muted">From</label>
          <input type="date" className="input-premium text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="grid grid-cols-[auto_1fr] items-center gap-2 sm:flex">
          <label className="text-xs text-muted">To</label>
          <input type="date" className="input-premium text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <X size={11} /> Clear
          </button>
        )}
      </div>

      {/* Report cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.35 }}
            className={`premium-card !p-5 cursor-pointer transition-all hover:shadow-md ${
              activeReport === r.id ? "ring-2 ring-blue-500 bg-blue-50/30" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="text-xl">{r.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-display text-sm font-bold text-navy-900 leading-tight">{r.name}</h3>
                  <span className="text-[10px] font-bold text-muted shrink-0">#{r.id}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted leading-relaxed">{r.desc}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                className="!min-h-0 !px-3 !py-1.5 !text-[11px] flex-1"
                disabled={loading}
                onClick={() => runReport(r.id)}
              >
                {loading && loadingReportId === r.id ? (
                  <><Loader2 size={11} className="animate-spin" /> Running&hellip;</>
                ) : (
                  <><ChevronRight size={11} /> Run Report</>
                )}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Results panel */}
      <AnimatePresence>
        {result && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="premium-card !p-0 overflow-hidden"
          >
            {/* Results header */}
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-display font-bold text-navy-900">{activeReportName}</h2>
                <p className="text-xs text-muted">{result.total} records{dateFrom || dateTo ? ` · filtered ${dateFrom || "…"} → ${dateTo || "…"}` : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" className="!min-h-0 !px-3 !py-1.5 !text-xs" onClick={handleExportCSV}>
                  <Download size={12} /> Export CSV
                </Button>
                <button aria-label="Close report results" onClick={() => { setResult(null); setActiveReport(null); }} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-slate-100 hover:text-ink">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Summary cards for certain reports */}
            {result.summary && (
              <div className="flex flex-wrap gap-4 border-b border-line p-4">
                {Object.entries(result.summary).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-blue-50 px-3 py-2 ring-1 ring-blue-100">
                    <p className="text-[10px] font-bold uppercase text-muted">{k}</p>
                    <p className="font-display text-lg font-bold text-navy-900">{String(v)}{k.toLowerCase().includes("rate") ? "%" : ""}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Data table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line bg-slate-50">
                    {result.columns.map((col) => (
                      <th key={col} className="px-4 py-2.5 text-left font-bold uppercase tracking-wide text-muted whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 200).map((row, i) => (
                    <tr key={i} className="border-b border-line/50 hover:bg-slate-50/60">
                      {result.columns.map((col) => (
                        <td key={col} className="px-4 py-2 text-ink whitespace-nowrap max-w-xs truncate">
                          {String(row[col] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length > 200 && (
                <p className="px-4 py-3 text-xs text-muted border-t border-line">
                  Showing 200 of {result.total} records. Export CSV for full data.
                </p>
              )}
              {result.rows.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted">No records found for the selected filters.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageReveal>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { Badge } from "@/components/ui/Badge";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/pallet-machine";
import { Search, Filter } from "lucide-react";

type Pallet = {
  id: string;
  palletNumber: string;
  qrCode: string;
  status: string;
  materialType: string;
  dimensions: string;
  tripCount: number;
  currentLocation: string | null;
  createdAt: string;
};

const STATUS_OPTIONS = [
  "", "available", "loaded", "in_transit", "delivered", "returning",
  "damaged", "under_repair", "retired", "lost",
];

export function PalletsPageClient({ initialPallets }: { initialPallets: Pallet[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const pallets = useMemo(() => {
    let filtered = initialPallets;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.palletNumber.toLowerCase().includes(q) ||
          p.materialType.toLowerCase().includes(q) ||
          (p.currentLocation && p.currentLocation.toLowerCase().includes(q))
      );
    }
    if (statusFilter) {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }
    return filtered;
  }, [search, statusFilter, initialPallets]);

  return (
    <PageReveal className="space-y-6">
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-navy-950 via-blue-900 to-blue-700 p-5 text-white shadow-xl sm:p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Pallets
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-blue-50/90">
              {initialPallets.length} pallets registered · Search by number, material, or location.
            </p>
          </div>
          <Link
            href="/admin/pallets/register"
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-navy-900 shadow-md sm:w-auto"
          >
            + Register pallet
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-sm max-w-md">
          <Search size={14} className="text-muted" />
          <input
            type="text"
            placeholder="Search pallets…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-sm">
          <Filter size={14} className="text-muted" />
          <select
            className="bg-transparent text-sm text-ink outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s as keyof typeof STATUS_LABELS] || s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pallet list */}
      <div className="space-y-2">
        {pallets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-3 py-12 text-center text-sm text-muted">
            {initialPallets.length === 0
              ? "No pallets registered yet. Go to Scan / Register to add your first pallet."
              : "No pallets match your search."}
          </div>
        ) : (
          pallets.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.3 }}
            >
              <Link
                href={`/admin/pallets/${p.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md">
                  <span className="text-xs font-bold">{p.palletNumber.slice(-3)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-navy-900 mono-code">
                      {p.palletNumber}
                    </p>
                    <Badge tone={(STATUS_COLORS[p.status as keyof typeof STATUS_COLORS] || "neutral") as "ok" | "teal" | "blue" | "neutral" | "field" | "dispatch" | "warn" | "danger"}>
                      {STATUS_LABELS[p.status as keyof typeof STATUS_LABELS] || p.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {p.materialType} · {p.dimensions} · {p.tripCount} trips
                    {p.currentLocation ? ` · ${p.currentLocation}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                  View →
                </span>
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </PageReveal>
  );
}

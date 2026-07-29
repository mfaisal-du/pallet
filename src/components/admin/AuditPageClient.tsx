"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format-date";
import { ScrollText, Filter } from "lucide-react";

type AuditEntry = {
  id: string;
  userEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
  createdAt: string;
};

export function AuditPageClient({ entries }: { entries: AuditEntry[] }) {
  const [actionFilter, setActionFilter] = useState("");
  const actions = [...new Set(entries.map((e) => e.action))].sort();
  const filtered = actionFilter
    ? entries.filter((e) => e.action === actionFilter)
    : entries;

  return (
    <PageReveal className="space-y-6">
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-navy-950 via-[#1c2038] to-[#12263f] p-5 text-white shadow-xl sm:p-6">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Audit Log
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-blue-50/90">
              Immutable record of every state-changing action · {entries.length} entries
            </p>
          </div>
          <ScrollText size={32} className="text-white/20" />
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-sm max-w-xs">
        <Filter size={14} className="text-muted" />
        <select
          className="w-full bg-transparent text-sm text-ink outline-none"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-3 py-12 text-center text-sm text-muted">
            No audit entries yet.
          </div>
        ) : (
          filtered.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
              className="rounded-2xl border border-line bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">{entry.action.replace(/_/g, " ")}</Badge>
                {entry.entity && (
                  <Badge tone="neutral">{entry.entity}</Badge>
                )}
                {entry.entityId && (
                  <span className="mono-code text-[10px] text-muted">{entry.entityId.slice(0, 8)}…</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="break-all font-semibold text-ink">{entry.userEmail || "system"}</span>
                <span>·</span>
                <span>{formatDateTime(entry.createdAt)}</span>
              </div>
              {entry.detail && (
                <p className="mt-1.5 break-words text-xs text-muted">{entry.detail}</p>
              )}
            </motion.div>
          ))
        )}
      </div>
    </PageReveal>
  );
}

import type { PrismaClient, PalletStatus } from "@prisma/client";
import { STATUS_LABELS as DEFAULT_STATUS_LABELS } from "@/lib/pallet-machine";

/**
 * Configurable status display labels (client customization, Q1 of client-feedback-analysis).
 *
 * Internal PalletStatus enum values stay stable — only the *display* label is
 * customizable. Each status maps to one Setting row so reports, the state machine,
 * filters and CSV exports keep working on the stable identifiers.
 */

/** Setting-table key for each status's display label. */
export const STATUS_LABEL_KEYS: Record<PalletStatus, string> = {
  available: "status_label_available",
  loaded: "status_label_loaded",
  in_transit: "status_label_in_transit",
  delivered: "status_label_delivered",
  returning: "status_label_returning",
  damaged: "status_label_damaged",
  under_repair: "status_label_under_repair",
  retired: "status_label_retired",
  lost: "status_label_lost",
};

export const ALL_STATUSES = Object.keys(DEFAULT_STATUS_LABELS) as PalletStatus[];

/** Max length for a custom display label. */
export const STATUS_LABEL_MAX = 40;

/**
 * Resolve the effective display labels: DB overrides merged over the built-in defaults.
 * Always returns a full map for every status.
 */
export async function getStatusLabels(
  prisma: PrismaClient
): Promise<Record<PalletStatus, string>> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(STATUS_LABEL_KEYS) } },
  });
  const overrides = Object.fromEntries(rows.map((s) => [s.key, s.value.trim()]));
  const labels = { ...DEFAULT_STATUS_LABELS };
  for (const status of ALL_STATUSES) {
    const v = overrides[STATUS_LABEL_KEYS[status]];
    if (v) labels[status] = v;
  }
  return labels;
}

/**
 * Map a single raw status value to its display label, falling back to the raw value.
 * Safe for server-side report rows and CSV output.
 */
export function labelFor(
  labels: Record<PalletStatus, string>,
  status: string | null | undefined
): string {
  if (!status) return "—";
  return labels[status as PalletStatus] || status;
}

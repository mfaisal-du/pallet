"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PalletStatus } from "@prisma/client";
import { STATUS_LABELS as DEFAULT_STATUS_LABELS } from "@/lib/pallet-machine";

export type StatusLabels = Record<PalletStatus, string>;

const StatusLabelsContext = createContext<StatusLabels>(DEFAULT_STATUS_LABELS);

/**
 * Fetches the resolved status display labels once and shares them with every
 * pallet surface (scan, lists, profile, command center, dashboard, dispatch).
 * Falls back to the built-in defaults while loading or on error.
 */
export function StatusLabelsProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<StatusLabels>(DEFAULT_STATUS_LABELS);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/status-labels")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.labels) return;
        setLabels({ ...DEFAULT_STATUS_LABELS, ...data.labels });
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      active = false;
    };
  }, []);

  return <StatusLabelsContext.Provider value={labels}>{children}</StatusLabelsContext.Provider>;
}

/** Returns the current status display labels (falls back to defaults). */
export function useStatusLabels(): StatusLabels {
  return useContext(StatusLabelsContext);
}

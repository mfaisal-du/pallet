"use client";

import type { ReactNode } from "react";
import { Search, Rows3, List, LayoutGrid } from "lucide-react";

export type DataViewMode = "table" | "list" | "cards";

export function AdminDataToolbar({
  search,
  onSearch,
  searchPlaceholder,
  count,
  view,
  onViewChange,
  trailing,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  count: number;
  view?: DataViewMode;
  onViewChange?: (v: DataViewMode) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 basis-full sm:min-w-[200px] sm:max-w-md sm:flex-1">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              placeholder={searchPlaceholder || "Search…"}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        </div>

        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-200">
          {count}
        </span>

        {view && onViewChange && (
          <div className="flex rounded-lg border border-line bg-white p-0.5">
            {([
              ["table", Rows3],
              ["list", List],
              ["cards", LayoutGrid],
            ] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => onViewChange(mode)}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                  view === mode ? "bg-navy-900 text-white shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        )}
      </div>

      {trailing && <div className="flex flex-wrap gap-2">{trailing}</div>}
    </div>
  );
}

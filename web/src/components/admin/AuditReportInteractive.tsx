"use client";

import { useMemo, useState, useTransition } from "react";
import type { AuditReportRow } from "@/app/admin/audit-report/actions";
import { getAuditReportDataAction } from "@/app/admin/audit-report/actions";

export function AuditReportInteractive({ initial }: { initial: AuditReportRow[] }) {
  const [rows, setRows] = useState(initial);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pending, startTransition] = useTransition();

  function handleFilter() {
    startTransition(async () => {
      const data = await getAuditReportDataAction({ fromDate: fromDate || undefined, toDate: toDate || undefined });
      setRows(data);
    });
  }

  const byActionType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.action_type, (counts.get(r.action_type) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const byUser = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const label = r.user_name ?? "Unknown";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-[#666]">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 block rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
            />
          </label>
          <label className="text-xs text-[#666]">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 block rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={handleFilter}
            disabled={pending}
            className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
          >
            Filter
          </button>
        </div>
        <p className="mt-2 text-xs text-[#666]">{rows.length} total logged action{rows.length === 1 ? "" : "s"} in range.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
          <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">By Action Type</h3>
          <div className="divide-y divide-[#f0f0f0]">
            {byActionType.map(([type, count]) => (
              <div key={type} className="py-1.5 flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-[#333]">{type}</span>
                <span className="text-[#666]">{count}</span>
              </div>
            ))}
            {byActionType.length === 0 && <p className="py-2 text-sm text-[#666]">No data in range.</p>}
          </div>
        </div>

        <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
          <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">By User</h3>
          <div className="divide-y divide-[#f0f0f0]">
            {byUser.map(([name, count]) => (
              <div key={name} className="py-1.5 flex items-center justify-between text-sm">
                <span className="text-[#333]">{name}</span>
                <span className="text-[#666]">{count}</span>
              </div>
            ))}
            {byUser.length === 0 && <p className="py-2 text-sm text-[#666]">No data in range.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { AuditLogRow, AuditConfigRow } from "@/app/admin/audit-logs/actions";
import { getAuditLogsAction, toggleAuditConfigAction } from "@/app/admin/audit-logs/actions";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AuditLogsInteractive({
  initialLogs,
  actionTypes,
  initialConfig,
}: {
  initialLogs: AuditLogRow[];
  actionTypes: string[];
  initialConfig: AuditConfigRow[];
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [config, setConfig] = useState(initialConfig);
  const [actionType, setActionType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleFilter() {
    startTransition(async () => {
      const rows = await getAuditLogsAction({
        actionType: actionType || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setLogs(rows);
    });
  }

  function handleToggleConfig(type: string, enabled: boolean) {
    setConfig((prev) => prev.map((c) => (c.action_type === type ? { ...c, enabled } : c)));
    startTransition(async () => {
      await toggleAuditConfigAction(type, enabled);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <div className="flex flex-wrap items-end gap-3 mb-2">
          <label className="text-xs text-[#666]">
            Action Type
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="mt-1 block rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
            >
              <option value="">All</option>
              {actionTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
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
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="ml-auto rounded-md bg-[#f0f0f0] px-4 py-2 text-sm font-semibold text-[#333] hover:bg-[#e0e0e0]"
          >
            {showConfig ? "Hide" : "Configure Logged Actions"}
          </button>
        </div>

        {showConfig && (
          <div className="mt-3 border-t border-[#f0f0f0] pt-3 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-80 overflow-y-auto">
            {config.map((c) => (
              <label key={c.action_type} className="flex items-center gap-2 text-xs py-1">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) => handleToggleConfig(c.action_type, e.target.checked)}
                />
                <span className="font-mono text-[#666]">{c.action_type}</span>
                {c.description && <span className="text-[#999]">— {c.description}</span>}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f5f5f5] text-left text-[#666]">
              <th className="px-4 py-2 font-semibold">When</th>
              <th className="px-4 py-2 font-semibold">Action</th>
              <th className="px-4 py-2 font-semibold">User</th>
              <th className="px-4 py-2 font-semibold">Group</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-2 whitespace-nowrap text-[#666]">{formatWhen(log.occurred_at)}</td>
                <td className="px-4 py-2 font-mono text-xs text-[#333]">{log.action_type}</td>
                <td className="px-4 py-2 text-[#333]">{log.user_name ?? "—"}</td>
                <td className="px-4 py-2 text-[#666]">{log.group_name ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[#666]">
                  No log entries match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#666]">Showing up to the 300 most recent matching entries.</p>
    </div>
  );
}

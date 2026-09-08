"use client";

import { useMemo, useState } from "react";
import type { AuditReportRow, AuditReportUser } from "@/app/admin/audit-report/actions";
import { easternDateKey, formatDateKey } from "@/lib/timezone";
import { DateFilterModal } from "@/components/outreach/DateFilterModal";

function formatDay(dateKey: string): string {
  return formatDateKey(dateKey, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** REQUIREMENTS.md §6.14 -- by day (latest first), each day showing every
 * user active that day and their hit count. Filtering to one user reduces
 * this to only the days that user has any activity, showing just their
 * count for each. */
export function AuditReportInteractive({ initial, users }: { initial: AuditReportRow[]; users: AuditReportUser[] }) {
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const dateFilterActive = Boolean(dateFrom || dateTo);

  const byDay = useMemo(() => {
    const days = new Map<string, Map<string, number>>(); // day -> (userLabel -> count)
    for (const r of initial) {
      if (userId && r.user_id !== userId) continue;
      const day = easternDateKey(r.occurred_at);
      // Same "YYYY-MM-DD" Eastern-calendar-day filter as the Audit Log's
      // Date Filter (DateFilterModal) -- comparable directly as strings
      // since `day` and the picker values are already same-format date keys.
      if (dateFrom && day < dateFrom) continue;
      if (dateTo && day > dateTo) continue;
      const label = r.user_name ?? "Unknown";
      if (!days.has(day)) days.set(day, new Map());
      const users = days.get(day)!;
      users.set(label, (users.get(label) ?? 0) + 1);
    }
    return Array.from(days.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, userCounts]) => ({
        day,
        users: Array.from(userCounts.entries()).sort((a, b) => b[1] - a[1]),
      }));
  }, [initial, userId, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-[#666]">
            User
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-1 block rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowDateFilter(true)}
            className="flex items-center gap-1 rounded-md border border-[#ddd] px-3 py-2 text-sm text-[#333] hover:bg-[#f5f5f5] shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            Date Filter
            {dateFilterActive && <span className="rounded-full bg-[#1e3a5f] text-white text-[10px] px-1.5 py-0.5">1</span>}
            <span className="text-[#999]">▾</span>
          </button>
        </div>
        <p className="mt-2 text-xs text-[#666]">{byDay.length} day{byDay.length === 1 ? "" : "s"} with activity.</p>
      </div>

      {showDateFilter && (
        <DateFilterModal
          dateFrom={dateFrom}
          dateTo={dateTo}
          onApply={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
            setShowDateFilter(false);
          }}
          onClose={() => setShowDateFilter(false)}
        />
      )}

      <div className="space-y-3">
        {byDay.map(({ day, users: dayUsers }) => (
          <div key={day} className="rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
            <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">{formatDay(day)}</h3>
            <div className="divide-y divide-[#f0f0f0]">
              {dayUsers.map(([label, count]) => (
                <div key={label} className="py-1.5 flex items-center justify-between text-sm">
                  <span className="text-[#333]">{label}</span>
                  <span className="text-[#666]">{count} hit{count === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {byDay.length === 0 && (
          <div className="rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5 text-center text-sm text-[#666]">
            No activity to show.
          </div>
        )}
      </div>
    </div>
  );
}

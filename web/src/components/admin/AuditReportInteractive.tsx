"use client";

import { useMemo, useState } from "react";
import type { AuditReportRow, AuditReportUser } from "@/app/admin/audit-report/actions";

function formatDay(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** REQUIREMENTS.md §6.14 -- by day (latest first), each day showing every
 * user active that day and their hit count. Filtering to one user reduces
 * this to only the days that user has any activity, showing just their
 * count for each. */
export function AuditReportInteractive({ initial, users }: { initial: AuditReportRow[]; users: AuditReportUser[] }) {
  const [userId, setUserId] = useState("");

  const byDay = useMemo(() => {
    const days = new Map<string, Map<string, number>>(); // day -> (userLabel -> count)
    for (const r of initial) {
      if (userId && r.user_id !== userId) continue;
      const day = r.occurred_at.slice(0, 10);
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
  }, [initial, userId]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
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
        <p className="mt-2 text-xs text-[#666]">{byDay.length} day{byDay.length === 1 ? "" : "s"} with activity.</p>
      </div>

      <div className="space-y-3">
        {byDay.map(({ day, users: dayUsers }) => (
          <div key={day} className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
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
          <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5 text-center text-sm text-[#666]">
            No activity to show.
          </div>
        )}
      </div>
    </div>
  );
}

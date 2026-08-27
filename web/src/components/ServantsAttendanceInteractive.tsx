"use client";

import { useMemo, useState, useTransition } from "react";
import type { ServantAttendanceBundle } from "@/lib/servant-attendance";
import { setServantAttendanceAction } from "@/app/servants-attendance/actions";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** REQUIREMENTS.md §6.13 -- same Present/Absent/"Never Attended" pattern as
 * the member Attendance tab (§6.5), applied to servants across the whole
 * ministry (not scoped to one group). */
export function ServantsAttendanceInteractive({ bundle }: { bundle: ServantAttendanceBundle }) {
  const [attendanceByServant, setAttendanceByServant] = useState(bundle.attendanceByServant);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const dateOptions = useMemo(() => {
    const options = bundle.trackedDates.map((d) => ({
      value: d,
      label: d === bundle.todayDate ? `${formatDate(d)} (Today)` : formatDate(d),
    }));
    if (bundle.todayAvailable && !bundle.trackedDates.includes(bundle.todayDate)) {
      options.unshift({ value: bundle.todayDate, label: `${formatDate(bundle.todayDate)} (Today)` });
    }
    return options;
  }, [bundle.trackedDates, bundle.todayDate, bundle.todayAvailable]);

  const [date, setDate] = useState(dateOptions[0]?.value ?? bundle.todayDate);

  function statusLabel(servantId: string): "Present" | "Absent" | "Never Attended" {
    const dates = attendanceByServant[servantId] ?? [];
    if (dates.includes(date)) return "Present";
    return dates.length > 0 ? "Absent" : "Never Attended";
  }

  function handleToggle(servantId: string, fullName: string) {
    const isPresent = (attendanceByServant[servantId] ?? []).includes(date);
    const nextPresent = !isPresent;
    if (!confirm(`Mark ${fullName} as ${nextPresent ? "present" : "absent"} for ${date}?`)) return;
    setTogglingId(servantId);
    startTransition(async () => {
      const result = await setServantAttendanceAction(servantId, date, nextPresent);
      setTogglingId(null);
      if (result.error) {
        alert(result.error);
        return;
      }
      setAttendanceByServant((prev) => {
        const dates = prev[servantId] ?? [];
        return { ...prev, [servantId]: nextPresent ? [...dates, date] : dates.filter((d) => d !== date) };
      });
    });
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? bundle.members.filter((m) => m.full_name.toLowerCase().includes(q)) : bundle.members;
    return [...filtered].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [bundle.members, search]);

  if (dateOptions.length === 0) {
    return (
      <div className="mt-4 rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-6 text-center text-sm text-[#666]">
        No service dates are tracked yet for servants, and today isn&rsquo;t open for attendance until the configured
        cutoff time.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-[#333]">Service Date</label>
        <select
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
        >
          {dateOptions.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search servants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[160px] rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
        />
      </div>

      <p className="text-xs text-[#666]">Attendance % is a rolling trailing 12 months.</p>

      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f5f5f5] text-left text-[#666]">
              <th className="px-4 py-2 font-semibold">Servant</th>
              <th className="px-4 py-2 font-semibold">Group</th>
              <th className="px-4 py-2 font-semibold">Attendance %</th>
              <th className="px-4 py-2 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {visible.map((m) => {
              const status = statusLabel(m.id);
              return (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 font-medium text-[#333]">{m.full_name}</td>
                  <td className="px-4 py-2.5 text-[#666]">{m.groupLabel}</td>
                  <td className="px-4 py-2.5 text-[#666]">
                    {m.averageAttendance === null ? "N/A" : `${m.averageAttendance}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={togglingId === m.id}
                      onClick={() => handleToggle(m.id, m.full_name)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                        status === "Present"
                          ? "bg-[#d4edda] text-[#155724] hover:bg-[#c3e6cb]"
                          : status === "Absent"
                            ? "bg-[#f8d7da] text-[#721c24] hover:bg-[#f5c6cb]"
                            : "bg-[#fff3cd] text-[#856404] hover:bg-[#ffeeba]"
                      }`}
                    >
                      {status}
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[#666]">
                  No servants to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

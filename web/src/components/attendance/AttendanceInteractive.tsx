"use client";

import { useState, useTransition } from "react";
import type { AttendanceMember } from "@/lib/attendance";
import { setAttendanceAction, getAttendanceForDateAction } from "@/app/g/[groupId]/attendance/actions";

const PROXIMITY_BADGE: Record<string, string> = {
  Local: "bg-[#d1ecf1] text-[#0c5460]",
  Regional: "bg-[#fff3cd] text-[#856404]",
  Abroad: "bg-[#f8d7da] text-[#721c24]",
  Unknown: "bg-[#e2e3e5] text-[#383d41]",
};

/** REQUIREMENTS.md §6.5 -- date picker + Present/Absent/"Never Attended"
 * table. Only Present is a real per-date write (a row exists or doesn't,
 * confirmed no separate status column); "Never Attended" is an automatic
 * badge that fully replaces "Absent" for anyone with zero attendance
 * history, not a third writable state. */
export function AttendanceInteractive({
  groupId,
  dateOptions,
  initialDate,
  initialMembers,
  memberLabel,
}: {
  groupId: string;
  dateOptions: { value: string; label: string }[];
  initialDate: string;
  initialMembers: AttendanceMember[];
  memberLabel: string;
}) {
  const [date, setDate] = useState(initialDate);
  const [members, setMembers] = useState(initialMembers);
  const [loading, startLoading] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);

  function handleDateChange(newDate: string) {
    setDate(newDate);
    startLoading(async () => {
      const data = await getAttendanceForDateAction(groupId, newDate);
      setMembers(data);
    });
  }

  function handleToggle(member: AttendanceMember) {
    const nextPresent = !member.present;
    if (!confirm(`Mark ${member.full_name} as ${nextPresent ? "present" : "absent"} for ${date}?`)) return;
    setTogglingId(member.id);
    startLoading(async () => {
      const result = await setAttendanceAction(member.id, groupId, date, nextPresent);
      setTogglingId(null);
      if (result.error) {
        alert(result.error);
        return;
      }
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, present: nextPresent } : m)));
    });
  }

  const sorted = [...members].sort((a, b) =>
    sortDesc ? b.full_name.localeCompare(a.full_name) : a.full_name.localeCompare(b.full_name),
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-semibold text-[#333]">Service Date</label>
        <select
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          disabled={loading}
          className="rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
        >
          {dateOptions.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f5f5f5] text-left text-[#666]">
              <th className="px-4 py-2">
                <button type="button" onClick={() => setSortDesc((v) => !v)} className="font-semibold hover:underline">
                  {memberLabel} {sortDesc ? "▼" : "▲"}
                </button>
              </th>
              <th className="px-4 py-2">Proximity</th>
              <th className="px-4 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {sorted.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2.5">
                  <span className="font-medium text-[#333]">{m.full_name}</span>
                  {m.is_visitor && (
                    <span className="ml-2 rounded-full bg-[#e2e3e5] text-[#383d41] text-[10px] px-2 py-0.5 align-middle">
                      Visitor
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PROXIMITY_BADGE[m.proximity]}`}>
                    {m.proximity}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    disabled={togglingId === m.id}
                    onClick={() => handleToggle(m)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                      m.present
                        ? "bg-[#d4edda] text-[#155724] hover:bg-[#c3e6cb]"
                        : m.everAttended
                          ? "bg-[#f8d7da] text-[#721c24] hover:bg-[#f5c6cb]"
                          : "bg-[#fff3cd] text-[#856404] hover:bg-[#ffeeba]"
                    }`}
                  >
                    {m.present ? "Present" : m.everAttended ? "Absent" : "Never Attended"}
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-[#666]">
                  No {memberLabel.toLowerCase()}s in this group yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

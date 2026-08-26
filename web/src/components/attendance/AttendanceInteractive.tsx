"use client";

import { useMemo, useState, useTransition } from "react";
import type { AttendanceMember } from "@/lib/attendance";
import { useMyAssigned } from "@/components/MyAssignedContext";
import { setAttendanceAction, getAttendanceForDateAction } from "@/app/g/[groupId]/attendance/actions";

const PROXIMITY_BADGE: Record<string, string> = {
  Local: "bg-[#d1ecf1] text-[#0c5460]",
  Regional: "bg-[#fff3cd] text-[#856404]",
  Abroad: "bg-[#f8d7da] text-[#721c24]",
  Unknown: "bg-[#e2e3e5] text-[#383d41]",
};

const STATUS_RANK: Record<"Present" | "Absent" | "Never Attended", number> = {
  Present: 0,
  Absent: 1,
  "Never Attended": 2,
};

function statusLabel(m: AttendanceMember): "Present" | "Absent" | "Never Attended" {
  if (m.present) return "Present";
  return m.everAttended ? "Absent" : "Never Attended";
}

type SortKey = "name" | "proximity" | "status";

/** REQUIREMENTS.md §6.5 -- date picker + Present/Absent/"Never Attended"
 * table. Only Present is a real per-date write (a row exists or doesn't,
 * confirmed no separate status column); "Never Attended" is an automatic
 * badge that fully replaces "Absent" for anyone with zero attendance
 * history, not a third writable state. Respects "My Assigned List"
 * (§6.2) like every other tab. */
export function AttendanceInteractive({
  groupId,
  dateOptions,
  initialDate,
  initialMembers,
  memberLabel,
  currentUserId,
}: {
  groupId: string;
  dateOptions: { value: string; label: string }[];
  initialDate: string;
  initialMembers: AttendanceMember[];
  memberLabel: string;
  currentUserId: string;
}) {
  const { myAssignedOnly, hydrated } = useMyAssigned();
  const [date, setDate] = useState(initialDate);
  const [members, setMembers] = useState(initialMembers);
  const [loading, startLoading] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);

  function handleDateChange(newDate: string) {
    setDate(newDate);
    startLoading(async () => {
      const data = await getAttendanceForDateAction(groupId, newDate);
      setMembers(data);
    });
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((v) => !v);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
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

  const visible = useMemo(() => {
    const filtered = hydrated && myAssignedOnly ? members.filter((m) => m.assigned_servant_id === currentUserId) : members;
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.full_name.localeCompare(b.full_name);
      else if (sortKey === "proximity") cmp = a.proximity.localeCompare(b.proximity);
      else cmp = STATUS_RANK[statusLabel(a)] - STATUS_RANK[statusLabel(b)];
      return sortDesc ? -cmp : cmp;
    });
    return sorted;
  }, [members, hydrated, myAssignedOnly, currentUserId, sortKey, sortDesc]);

  function sortIndicator(key: SortKey) {
    return sortKey === key ? (sortDesc ? " ▼" : " ▲") : "";
  }

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
                <button type="button" onClick={() => handleSort("name")} className="font-semibold hover:underline">
                  {memberLabel}
                  {sortIndicator("name")}
                </button>
              </th>
              <th className="px-4 py-2">
                <button type="button" onClick={() => handleSort("proximity")} className="font-semibold hover:underline">
                  Proximity
                  {sortIndicator("proximity")}
                </button>
              </th>
              <th className="px-4 py-2 text-right">
                <button type="button" onClick={() => handleSort("status")} className="font-semibold hover:underline">
                  Status
                  {sortIndicator("status")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {visible.map((m) => {
              const status = statusLabel(m);
              return (
                <tr key={m.id}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-[#333]">{m.full_name}</span>
                    {m.is_visitor && (
                      <span className="ml-2 rounded-full bg-[#ffe5cc] text-[#b35900] text-[10px] font-semibold px-2 py-0.5 align-middle">
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
                <td colSpan={3} className="px-4 py-6 text-center text-[#666]">
                  No {memberLabel.toLowerCase()}s to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { AnalyticsRawData } from "@/lib/analytics";
import type { ServantOption } from "@/lib/servants";
import { useMyAssigned } from "@/components/MyAssignedContext";
import { ClipboardCheckIcon, UsersIcon, ChartBarIcon, MapPinIcon } from "@/components/icons";
import { ProximityDonut } from "@/components/charts/ProximityDonut";
import { AttendanceTrendChart } from "@/components/charts/AttendanceTrendChart";

type SortKey = "name" | "gender" | "caseload" | "cohort";

/** REQUIREMENTS.md §6.7 -- Data Completeness and Average Attendance by
 * Month respect "My Assigned List" (§6.2) like every other tab; Servant
 * Assignments deliberately doesn't (see lib/analytics.ts) but its columns
 * are all sortable. `combined` (the "Load Youth Data for all cohorts" view,
 * §6.1 addendum) adds a sortable Cohort column -- redundant everywhere else,
 * since a single-cohort table only ever lists one cohort's servants. */
export function AnalyticsInteractive({
  raw,
  servants,
  unassignedCount,
  memberLabel,
  currentUserId,
  combined = false,
}: {
  raw: AnalyticsRawData;
  servants: ServantOption[];
  unassignedCount: number;
  memberLabel: string;
  currentUserId: string;
  combined?: boolean;
}) {
  const { myAssignedOnly, hydrated } = useMyAssigned();
  const applyFilter = hydrated && myAssignedOnly;
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);

  const filteredMembers = useMemo(() => {
    const rows = applyFilter ? raw.members.filter((m) => m.assigned_servant_id === currentUserId) : raw.members;
    return rows.filter((m) => !m.is_visitor);
  }, [raw.members, applyFilter, currentUserId]);

  const completeness = useMemo(() => {
    const total = filteredMembers.length;
    const pct = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);
    return {
      total,
      pctAssignedServant: pct(filteredMembers.filter((m) => m.assigned_servant_id).length),
      pctPhone: pct(filteredMembers.filter((m) => m.hasPhone).length),
      pctEmail: pct(filteredMembers.filter((m) => m.hasEmail).length),
      pctDob: pct(filteredMembers.filter((m) => m.hasDob).length),
      pctFatherOfConfession: pct(filteredMembers.filter((m) => m.hasFatherOfConfession).length),
      pctPhoto: pct(filteredMembers.filter((m) => m.hasPhoto).length),
    };
  }, [filteredMembers]);

  const proximity = useMemo(() => {
    const counts = { Local: 0, Regional: 0, Abroad: 0, Unknown: 0 };
    for (const m of filteredMembers) counts[m.proximity] += 1;
    return counts;
  }, [filteredMembers]);

  const monthly = useMemo(() => {
    const filteredIds = new Set(filteredMembers.map((m) => m.id));
    const relevantAttendance = raw.attendance.filter((a) => filteredIds.has(a.memberId));

    const datesByMonth = new Map<string, Set<string>>();
    for (const a of relevantAttendance) {
      const month = a.serviceDate.slice(0, 7);
      if (!datesByMonth.has(month)) datesByMonth.set(month, new Set());
      datesByMonth.get(month)!.add(a.serviceDate);
    }
    const presentSet = new Set(relevantAttendance.map((a) => `${a.memberId}|${a.serviceDate}`));

    return Array.from(datesByMonth.keys())
      .sort()
      .reverse()
      .map((month) => {
        const dates = Array.from(datesByMonth.get(month)!);
        let presentCount = 0;
        let totalSlots = 0;
        for (const m of filteredMembers) {
          if (!m.join_date) continue;
          const since = m.join_date;
          for (const d of dates) {
            if (d < since) continue;
            totalSlots += 1;
            if (presentSet.has(`${m.id}|${d}`)) presentCount += 1;
          }
        }
        const avgPercent = totalSlots > 0 ? Math.round((presentCount / totalSlots) * 100) : 0;
        const label = new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        });
        return { month, label, avgPercent };
      });
  }, [filteredMembers, raw.attendance]);

  const sortedServants = useMemo(() => {
    return [...servants].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.full_name.localeCompare(b.full_name);
      else if (sortKey === "gender") cmp = (a.gender ?? "").localeCompare(b.gender ?? "");
      else if (sortKey === "cohort") cmp = a.groupNames.join(", ").localeCompare(b.groupNames.join(", "));
      else cmp = a.caseload - b.caseload;
      return sortDesc ? -cmp : cmp;
    });
  }, [servants, sortKey, sortDesc]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDesc((v) => !v);
    else {
      setSortKey(key);
      setSortDesc(false);
    }
  }
  function indicator(key: SortKey) {
    return sortKey === key ? (sortDesc ? " ▼" : " ▲") : "";
  }

  return (
    <div className="mt-4 space-y-6">
      <section className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#1e3a5f] mb-4">
          <ClipboardCheckIcon className="h-5 w-5" /> Data Completeness
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Assigned to Servants" value={completeness.pctAssignedServant} />
          <StatCard label="Has Phone" value={completeness.pctPhone} />
          <StatCard label="Has Email" value={completeness.pctEmail} />
          <StatCard label="Has Date of Birth" value={completeness.pctDob} />
          <StatCard label="Has Father of Confession" value={completeness.pctFatherOfConfession} />
          <StatCard label="Has Photo" value={completeness.pctPhoto} />
        </div>
        <p className="mt-3 text-xs text-[#666]">
          Based on {completeness.total} active {memberLabel.toLowerCase()}
          {completeness.total === 1 ? "" : "s"} (visitors excluded{applyFilter ? ", filtered to your assigned list" : ""}
          ).
        </p>
      </section>

      <section className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#1e3a5f] mb-4">
          <MapPinIcon className="h-5 w-5" /> Proximity
        </h2>
        <ProximityDonut
          local={proximity.Local}
          regional={proximity.Regional}
          abroad={proximity.Abroad}
          unknown={proximity.Unknown}
          centerLabel={`${memberLabel}s`}
        />
        <p className="mt-3 text-xs text-[#666]">
          {completeness.total} active {memberLabel.toLowerCase()}
          {completeness.total === 1 ? "" : "s"} (visitors excluded{applyFilter ? ", filtered to your assigned list" : ""}).
        </p>
      </section>

      <section className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#1e3a5f] mb-4">
          <ChartBarIcon className="h-5 w-5" /> Average Attendance by Month
        </h2>
        {monthly.length === 0 ? (
          <p className="text-sm text-[#666]">No tracked service dates yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <AttendanceTrendChart data={[...monthly].reverse()} />
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#1e3a5f] mb-4">
          <UsersIcon className="h-5 w-5" /> Servant Assignments
        </h2>
        <div className="overflow-hidden rounded-lg border border-[#f0f0f0]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f5f5f5] text-left text-[#666]">
                <th className="px-4 py-2">
                  <button type="button" onClick={() => handleSort("name")} className="font-semibold hover:underline">
                    Servant{indicator("name")}
                  </button>
                </th>
                <th className="px-4 py-2">
                  <button type="button" onClick={() => handleSort("gender")} className="font-semibold hover:underline">
                    Gender{indicator("gender")}
                  </button>
                </th>
                {combined && (
                  <th className="px-4 py-2">
                    <button type="button" onClick={() => handleSort("cohort")} className="font-semibold hover:underline">
                      Cohort{indicator("cohort")}
                    </button>
                  </th>
                )}
                <th className="px-4 py-2 text-right">
                  <button type="button" onClick={() => handleSort("caseload")} className="font-semibold hover:underline">
                    Assigned {memberLabel}s{indicator("caseload")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {sortedServants.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-medium text-[#333]">{s.full_name}</td>
                  <td className="px-4 py-2.5 text-[#666]">{s.gender ?? "—"}</td>
                  {combined && <td className="px-4 py-2.5 text-[#666]">{s.groupNames.join(", ") || "—"}</td>}
                  <td className="px-4 py-2.5 text-right text-[#333]">{s.caseload}</td>
                </tr>
              ))}
              <tr className="bg-[#f9f9f9]">
                <td className="px-4 py-2.5 font-semibold text-[#333]" colSpan={combined ? 3 : 2}>
                  Unassigned
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-[#333]">{unassignedCount}</td>
              </tr>
              {sortedServants.length === 0 && (
                <tr>
                  <td colSpan={combined ? 4 : 3} className="px-4 py-6 text-center text-[#666]">
                    No servants assigned to this group yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] border-t-4 border-[#1e3a5f] p-4">
      <h3 className="text-[11px] uppercase tracking-wide text-[#666] font-semibold">{label}</h3>
      <p className="mt-1 text-3xl font-bold text-[#1e3a5f]">{value}%</p>
    </div>
  );
}

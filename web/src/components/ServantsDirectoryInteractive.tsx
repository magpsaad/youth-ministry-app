"use client";

import { useMemo, useState } from "react";
import type { ServantDirectoryEntry } from "@/lib/servant-directory";
import { PhoneLink } from "@/components/PhoneLink";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

type Bucket = { label: string; entries: ServantDirectoryEntry[] };

/** REQUIREMENTS.md §6.13 -- read-only, searchable, grouped by serving group
 * (then General Coordinators, then Unassigned), with phone (tel: link) and
 * average attendance %. */
export function ServantsDirectoryInteractive({ servants }: { servants: ServantDirectoryEntry[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return servants;
    return servants.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [servants, search]);

  const buckets = useMemo(() => {
    const byLabel = new Map<string, ServantDirectoryEntry[]>();
    const order: string[] = [];

    function add(label: string, entry: ServantDirectoryEntry) {
      if (!byLabel.has(label)) {
        byLabel.set(label, []);
        order.push(label);
      }
      byLabel.get(label)!.push(entry);
    }

    for (const s of filtered) {
      for (const g of s.servantGroups) add(g.name, s);
      if (s.isUnassignedServant) add("Unassigned", s);
      if (s.isGeneralCoordinator) add("General Coordinators", s);
    }

    // Group buckets first (alphabetical), then General Coordinators, then Unassigned.
    const groupLabels = order.filter((l) => l !== "General Coordinators" && l !== "Unassigned").sort();
    const tail = order.filter((l) => l === "General Coordinators" || l === "Unassigned").sort().reverse();

    const result: Bucket[] = [];
    for (const label of [...groupLabels, ...tail]) {
      result.push({ label, entries: byLabel.get(label)!.sort((a, b) => a.full_name.localeCompare(b.full_name)) });
    }
    return result;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search servants..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
      />

      {buckets.length === 0 && <p className="text-sm text-[#666] text-center py-8">No servants match.</p>}

      {buckets.map((bucket) => (
        <div key={bucket.label} className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4">
          <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">{bucket.label}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bucket.entries.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border border-[#f0f0f0] rounded-lg p-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-[#1e3a5f] text-white text-sm font-bold flex items-center justify-center">
                  {initials(s.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#333] truncate">{s.full_name}</p>
                  <PhoneLink phone={s.phone} className="text-xs" />
                  <p className="text-[11px] text-[#666]">
                    Attendance: {s.averageAttendance === null ? "N/A" : `${s.averageAttendance}%`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

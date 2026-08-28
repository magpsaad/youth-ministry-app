"use client";

import { useMemo, useState } from "react";
import type { ServantDirectoryEntry } from "@/lib/servant-directory";
import { PhoneLink } from "@/components/PhoneLink";
import { servantPhotoUrl } from "@/lib/storage";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

type Bucket = { label: string; entries: ServantDirectoryEntry[] };

/** REQUIREMENTS.md §6.13 -- read-only, searchable. Categorical (grouped by
 * serving group, then General Coordinators, then Unassigned) and
 * Alphabetical view modes, consistent with Servant Profiles & Assignments. */
export function ServantsDirectoryInteractive({
  servants,
  windowWeeks,
}: {
  servants: ServantDirectoryEntry[];
  windowWeeks: number | null;
}) {
  const [viewMode, setViewMode] = useState<"categorical" | "alphabetical">("categorical");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return servants;
    return servants.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [servants, search]);

  const buckets = useMemo(() => {
    const byLabel = new Map<string, ServantDirectoryEntry[]>();
    const positionByLabel = new Map<string, number>();
    const order: string[] = [];

    function add(label: string, entry: ServantDirectoryEntry, ladderPosition?: number) {
      if (!byLabel.has(label)) {
        byLabel.set(label, []);
        order.push(label);
        if (ladderPosition !== undefined) positionByLabel.set(label, ladderPosition);
      }
      byLabel.get(label)!.push(entry);
    }

    for (const s of filtered) {
      for (const g of s.servantGroups) add(g.name, s, g.ladder_position);
      if (s.isUnassignedServant) add("Unassigned", s);
      if (s.isGeneralCoordinator) add("General Coordinators", s);
    }

    // Youngest-to-oldest cohort order (ladder_position ascending), not
    // alphabetical by name -- same fix as Servant Profiles/Assignments
    // (owner-reported), now consistent across all three screens.
    const groupLabels = order
      .filter((l) => l !== "General Coordinators" && l !== "Unassigned")
      .sort((a, b) => (positionByLabel.get(a) ?? 0) - (positionByLabel.get(b) ?? 0));
    const tail = order.filter((l) => l === "General Coordinators" || l === "Unassigned").sort().reverse();

    const result: Bucket[] = [];
    for (const label of [...groupLabels, ...tail]) {
      result.push({ label, entries: byLabel.get(label)!.sort((a, b) => a.full_name.localeCompare(b.full_name)) });
    }
    return result;
  }, [filtered]);

  const alphabetical = useMemo(() => [...filtered].sort((a, b) => a.full_name.localeCompare(b.full_name)), [filtered]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#666]">
        {windowWeeks === null
          ? "Attendance % is calculated over each servant's entire history since their Join Date."
          : `Attendance % is a rolling trailing ${windowWeeks} week${windowWeeks === 1 ? "" : "s"}, never counting weeks before someone joined.`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search servants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
        />
        <div className="flex rounded-md border border-[#ddd] overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setViewMode("categorical")}
            className={`px-3 py-2 font-semibold ${viewMode === "categorical" ? "bg-[#1e3a5f] text-white" : "bg-white text-[#333]"}`}
          >
            Categorical
          </button>
          <button
            type="button"
            onClick={() => setViewMode("alphabetical")}
            className={`px-3 py-2 font-semibold ${viewMode === "alphabetical" ? "bg-[#1e3a5f] text-white" : "bg-white text-[#333]"}`}
          >
            Alphabetical
          </button>
        </div>
      </div>

      {filtered.length === 0 && <p className="text-sm text-[#666] text-center py-8">No servants match.</p>}

      {viewMode === "categorical"
        ? buckets.map((bucket) => (
            <div key={bucket.label} className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4">
              <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">{bucket.label}</h3>
              <ServantCards entries={bucket.entries} />
            </div>
          ))
        : filtered.length > 0 && (
            <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4">
              <ServantCards entries={alphabetical} />
            </div>
          )}
    </div>
  );
}

function ServantCards({ entries }: { entries: ServantDirectoryEntry[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map((s) => {
        const photoUrl = servantPhotoUrl(s.photo_path);
        return (
          <div key={s.id} className="flex items-center gap-3 border border-[#f0f0f0] rounded-lg p-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-[#1e3a5f] text-white text-sm font-bold flex items-center justify-center overflow-hidden">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={s.full_name} className="h-full w-full object-cover" />
              ) : (
                initials(s.full_name)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#333] truncate">{s.full_name}</p>
              <PhoneLink phone={s.phone} className="text-xs" />
              <p className="text-[11px] text-[#666]">
                Attendance: {s.averageAttendance === null ? "N/A" : `${s.averageAttendance}%`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

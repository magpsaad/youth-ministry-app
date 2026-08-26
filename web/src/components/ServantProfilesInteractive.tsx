"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ServantDirectoryEntry } from "@/lib/servant-directory";
import type { GroupSummary } from "@/lib/groups";
import { PhoneLink } from "@/components/PhoneLink";
import { ServantDetailModal } from "@/components/ServantDetailModal";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

/** REQUIREMENTS.md §6.13 -- lists all servants; click any servant to view
 * their profile. Two view modes: Categorical (grouped by serving group,
 * then General Coordinators, then Unassigned; female before male within
 * each group) and Alphabetical. */
export function ServantProfilesInteractive({
  servants,
  groups,
  canManageServants,
}: {
  servants: ServantDirectoryEntry[];
  groups: GroupSummary[];
  canManageServants: boolean;
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"categorical" | "alphabetical">("categorical");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ServantDirectoryEntry | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return servants;
    return servants.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [servants, search]);

  const categorical = useMemo(() => {
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
    const groupLabels = order.filter((l) => l !== "General Coordinators" && l !== "Unassigned").sort();
    const tail = order.filter((l) => l === "General Coordinators" || l === "Unassigned").sort().reverse();

    return [...groupLabels, ...tail].map((label) => ({
      label,
      entries: byLabel.get(label)!.sort((a, b) => {
        const aRank = a.gender === "Female" ? 0 : 1;
        const bRank = b.gender === "Female" ? 0 : 1;
        return aRank - bRank || a.full_name.localeCompare(b.full_name);
      }),
    }));
  }, [filtered]);

  const alphabetical = useMemo(() => [...filtered].sort((a, b) => a.full_name.localeCompare(b.full_name)), [filtered]);

  function closeAndRefresh() {
    setSelected(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
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

      {viewMode === "categorical"
        ? categorical.map((bucket) => (
            <div key={bucket.label} className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4">
              <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">{bucket.label}</h3>
              <ServantRows entries={bucket.entries} onSelect={setSelected} />
            </div>
          ))
        : (
            <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4">
              <ServantRows entries={alphabetical} onSelect={setSelected} />
            </div>
          )}

      {filtered.length === 0 && <p className="text-sm text-[#666] text-center py-8">No servants match.</p>}

      {selected && (
        <ServantDetailModal
          servant={selected}
          groups={groups}
          canManageServants={canManageServants}
          onClose={() => setSelected(null)}
          onSaved={closeAndRefresh}
        />
      )}
    </div>
  );
}

function ServantRows({
  entries,
  onSelect,
}: {
  entries: ServantDirectoryEntry[];
  onSelect: (s: ServantDirectoryEntry) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s)}
          className="flex items-center gap-3 border border-[#f0f0f0] rounded-lg p-3 text-left hover:border-[#1e3a5f] transition-colors"
        >
          <div className="h-10 w-10 shrink-0 rounded-full bg-[#1e3a5f] text-white text-sm font-bold flex items-center justify-center">
            {initials(s.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[#333] truncate">{s.full_name}</p>
            <PhoneLink phone={s.phone} className="text-xs" />
          </div>
        </button>
      ))}
    </div>
  );
}

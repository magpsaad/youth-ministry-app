"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ServantDirectoryEntry } from "@/lib/servant-directory";
import type { GroupSummary } from "@/lib/groups";
import { servantPhotoUrl } from "@/lib/storage";
import { reassignServantGroupAction } from "@/app/servant-assignments/actions";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

/** REQUIREMENTS.md §6.13 -- lists every servant with their current cohort
 * assignment (or an "Assign" control if unassigned); General Coordinators/
 * Admins can assign, reassign, or unassign. Categorical (Unassigned at top,
 * then cohorts alphabetically) and Alphabetical view modes, consistent with
 * Servant Profiles/Servant Directory. */
export function ServantAssignmentsInteractive({
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Only people who actually need a cohort assignment -- holds a 'servant'
  // role (assigned or unassigned), not a General-Coordinator-only user.
  const assignable = useMemo(() => servants.filter((s) => s.servantGroups.length > 0 || s.isUnassignedServant), [servants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignable;
    return assignable.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [assignable, search]);

  const categorical = useMemo(() => {
    const unassigned = filtered.filter((s) => s.isUnassignedServant);
    const byGroup = new Map<string, ServantDirectoryEntry[]>();
    for (const s of filtered) {
      for (const g of s.servantGroups) {
        if (!byGroup.has(g.name)) byGroup.set(g.name, []);
        byGroup.get(g.name)!.push(s);
      }
    }
    const groupLabels = Array.from(byGroup.keys()).sort();
    const buckets: { label: string; entries: ServantDirectoryEntry[] }[] = [];
    if (unassigned.length > 0) {
      buckets.push({ label: "Unassigned", entries: unassigned.sort((a, b) => a.full_name.localeCompare(b.full_name)) });
    }
    for (const label of groupLabels) {
      buckets.push({ label, entries: byGroup.get(label)!.sort((a, b) => a.full_name.localeCompare(b.full_name)) });
    }
    return buckets;
  }, [filtered]);

  const alphabetical = useMemo(() => [...filtered].sort((a, b) => a.full_name.localeCompare(b.full_name)), [filtered]);

  function handleChange(servantId: string, newGroupId: string) {
    setPendingId(servantId);
    startTransition(async () => {
      const res = await reassignServantGroupAction(servantId, newGroupId || null);
      setPendingId(null);
      if (res.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
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

      {!canManageServants && (
        <p className="text-xs text-[#666]">Only General Coordinators/Admins can assign, reassign, or unassign a servant.</p>
      )}

      {filtered.length === 0 && <p className="text-sm text-[#666] text-center py-8">No servants match.</p>}

      {viewMode === "categorical"
        ? categorical.map((bucket) => (
            <div key={bucket.label} className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4">
              <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">{bucket.label}</h3>
              <AssignmentRows
                entries={bucket.entries}
                groups={groups}
                canManageServants={canManageServants}
                pendingId={pendingId}
                onChange={handleChange}
              />
            </div>
          ))
        : filtered.length > 0 && (
            <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4">
              <AssignmentRows
                entries={alphabetical}
                groups={groups}
                canManageServants={canManageServants}
                pendingId={pendingId}
                onChange={handleChange}
              />
            </div>
          )}
    </div>
  );
}

function AssignmentRows({
  entries,
  groups,
  canManageServants,
  pendingId,
  onChange,
}: {
  entries: ServantDirectoryEntry[];
  groups: GroupSummary[];
  canManageServants: boolean;
  pendingId: string | null;
  onChange: (servantId: string, newGroupId: string) => void;
}) {
  return (
    <div className="divide-y divide-[#f0f0f0]">
      {entries.map((s) => {
        const currentGroupId = s.servantGroups[0]?.id ?? "";
        const photoUrl = servantPhotoUrl(s.photo_path);
        return (
          <div key={s.id} className="py-2.5 flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-[#1e3a5f] text-white text-sm font-bold flex items-center justify-center overflow-hidden">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={s.full_name} className="h-full w-full object-cover" />
              ) : (
                initials(s.full_name)
              )}
            </div>
            <span className="flex-1 min-w-0 font-semibold text-[#333] truncate">{s.full_name}</span>
            <select
              value={currentGroupId}
              onChange={(e) => onChange(s.id, e.target.value === "unassigned" ? "" : e.target.value)}
              disabled={!canManageServants || pendingId === s.id}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none disabled:opacity-60 ${
                currentGroupId ? "border border-[#ddd] text-[#333]" : "bg-[#1e3a5f] text-white"
              }`}
            >
              {!currentGroupId && (
                <option value="" disabled hidden>
                  Assign
                </option>
              )}
              <option value="unassigned">Unassigned</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

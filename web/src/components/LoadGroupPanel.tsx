"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getRandomVerseAction } from "@/app/actions";
import type { GroupSummary } from "@/lib/groups";

export function LoadGroupPanel({
  groups,
  groupLabel,
  memberLabel,
}: {
  groups: GroupSummary[];
  groupLabel: string;
  memberLabel: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(groups[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [verse, setVerse] = useState<{ text: string; reference: string | null } | null>(null);

  async function handleLoad() {
    if (!selectedId) return;
    setLoading(true);
    const v = await getRandomVerseAction();
    setVerse(v);
    // Brief pause so the verse is actually readable, matching the current
    // app's loading-transition behavior (REQUIREMENTS.md §6.1).
    await new Promise((resolve) => setTimeout(resolve, 1400));
    router.push(`/g/${selectedId}/dashboard`);
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-[#666]">
        No groups are available to you yet. Contact an Admin for access.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor="group-select" className="text-sm font-semibold text-[#333] whitespace-nowrap">
          Select {groupLabel}
        </label>
        <select
          id="group-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loading}
          className="flex-1 min-w-0 rounded-md border border-[#ddd] px-2 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleLoad}
        disabled={loading}
        className="w-full rounded-md bg-[#1e3a5f] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#152a45] disabled:opacity-60"
      >
        {loading ? "Loading…" : `Load ${memberLabel} Data`}
      </button>

      {loading && (
        <div className="rounded-md border-l-4 border-[#ffc107] bg-[#fff3cd] px-4 py-3 text-sm text-[#856404]">
          {verse ? (
            <>
              <p className="italic">&ldquo;{verse.text}&rdquo;</p>
              {verse.reference && <p className="mt-1 font-semibold">— {verse.reference}</p>}
            </>
          ) : (
            <p>Loading…</p>
          )}
        </div>
      )}
    </div>
  );
}

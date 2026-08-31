"use client";

import { useMemo, useState } from "react";
import type { MemberListItem } from "@/lib/members";
import type { University } from "@/lib/universities";
import type { ServantOption } from "@/lib/servants";
import { useMyAssigned } from "@/components/MyAssignedContext";
import { MemberGrid } from "./MemberGrid";

const PROXIMITIES = ["Local", "Regional", "Abroad", "Unknown"];

export function MemberListInteractive({
  members,
  groupId,
  universities,
  servants,
  memberLabel,
  canDelete,
  currentUserId,
  currentUserName,
  windowWeeks,
  dayName,
}: {
  members: MemberListItem[];
  groupId: string;
  universities: University[];
  servants: ServantOption[];
  memberLabel: string;
  canDelete: boolean;
  currentUserId: string;
  currentUserName: string;
  windowWeeks: number | null;
  dayName: string;
}) {
  const { myAssignedOnly, hydrated } = useMyAssigned();
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [servantIds, setServantIds] = useState<string[]>([]);
  const [universityIds, setUniversityIds] = useState<string[]>([]);
  const [proximities, setProximities] = useState<string[]>([]);
  const [excludeVisitors, setExcludeVisitors] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [male, setMale] = useState(false);
  const [female, setFemale] = useState(false);

  const activeFilterCount =
    servantIds.length +
    universityIds.length +
    proximities.length +
    (excludeVisitors ? 1 : 0) +
    (hasPhoto ? 1 : 0) +
    (male ? 1 : 0) +
    (female ? 1 : 0);

  const filtered = useMemo(() => {
    let result = members;

    if (hydrated && myAssignedOnly) {
      result = result.filter((m) => m.assigned_servant_id === currentUserId);
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      result = result.filter((m) => m.full_name.toLowerCase().includes(needle));
    }
    if (excludeVisitors) result = result.filter((m) => !m.is_visitor);
    if (hasPhoto) result = result.filter((m) => !!m.photo_path);
    if (male || female) {
      result = result.filter((m) => (male && m.gender === "Male") || (female && m.gender === "Female"));
    }
    if (universityIds.length) {
      result = result.filter((m) => m.university && universityIds.includes(m.university.id));
    }
    if (proximities.length) {
      result = result.filter((m) => proximities.includes(m.university?.proximity ?? "Unknown"));
    }
    if (servantIds.length) {
      result = result.filter((m) => {
        if (servantIds.includes("unassigned") && !m.assigned_servant_id) return true;
        return m.assigned_servant_id && servantIds.includes(m.assigned_servant_id);
      });
    }

    return result;
  }, [members, q, excludeVisitors, hasPhoto, male, female, universityIds, proximities, servantIds, myAssignedOnly, hydrated, currentUserId]);

  function multiSelectValues(e: React.ChangeEvent<HTMLSelectElement>): string[] {
    return Array.from(e.target.selectedOptions).map((o) => o.value);
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${memberLabel.toLowerCase()}s…`}
          className="flex-1 rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10"
        />
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-[#dc3545] text-white text-[11px] px-2 py-0.5">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="mt-2 rounded-md border border-[#ddd] p-3 space-y-3 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold mb-1">Assigned Servant</p>
              <select
                multiple
                size={5}
                value={servantIds}
                onChange={(e) => setServantIds(multiSelectValues(e))}
                className="w-full rounded-md border border-[#ddd] text-sm"
              >
                <option value="unassigned">Unassigned</option>
                {servants.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">University/College</p>
              <select
                multiple
                size={5}
                value={universityIds}
                onChange={(e) => setUniversityIds(multiSelectValues(e))}
                className="w-full rounded-md border border-[#ddd] text-sm"
              >
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">Proximity</p>
            <div className="flex flex-wrap gap-4">
              {PROXIMITIES.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={proximities.includes(p)}
                    onChange={(e) =>
                      setProximities((prev) => (e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)))
                    }
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">Other</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={excludeVisitors} onChange={(e) => setExcludeVisitors(e.target.checked)} />
                Exclude Visitors
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={hasPhoto} onChange={(e) => setHasPhoto(e.target.checked)} />
                Has Photo
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={male} onChange={(e) => setMale(e.target.checked)} />
                Male
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={female} onChange={(e) => setFemale(e.target.checked)} />
                Female
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setServantIds([]);
                setUniversityIds([]);
                setProximities([]);
                setExcludeVisitors(false);
                setHasPhoto(false);
                setMale(false);
                setFemale(false);
              }}
              className="rounded-md bg-[#f0f0f0] px-4 py-2 text-sm font-semibold text-[#333] hover:bg-[#e0e0e0] shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="rounded-md bg-[#f0f0f0] px-4 py-2 text-sm font-semibold text-[#333] hover:bg-[#e0e0e0] shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
            >
              Close Filters
            </button>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-[#666]">
        {windowWeeks === null
          ? `Attendance % is calculated over each ${memberLabel.toLowerCase()}'s entire history since their Join Date, counting only ${dayName}s.`
          : `Attendance % is a rolling trailing ${windowWeeks} week${windowWeeks === 1 ? "" : "s"}, counting only ${dayName}s, never counting weeks before someone joined.`}
      </p>

      <MemberGrid
        members={filtered}
        groupId={groupId}
        universities={universities}
        servants={servants}
        memberLabel={memberLabel}
        canDelete={canDelete}
        currentUserName={currentUserName}
      />
    </div>
  );
}

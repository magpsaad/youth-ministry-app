"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MemberListItem, MemberDetail } from "@/lib/members";
import type { University } from "@/lib/universities";
import type { ServantOption } from "@/lib/servants";
import { getMemberAction } from "@/app/g/[groupId]/members/data-actions";
import { MemberDetailModal } from "./MemberDetailModal";

const PROXIMITY_BADGE: Record<string, string> = {
  Local: "bg-[#d1ecf1] text-[#0c5460]",
  Regional: "bg-[#fff3cd] text-[#856404]",
  Abroad: "bg-[#f8d7da] text-[#721c24]",
  Unknown: "bg-[#e2e3e5] text-[#383d41]",
};

export function MemberGrid({
  members,
  groupId,
  universities,
  servants,
  memberLabel,
  canDelete,
}: {
  members: MemberListItem[];
  groupId: string;
  universities: University[];
  servants: ServantOption[];
  memberLabel: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<MemberDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function openMember(id: string) {
    setLoadingId(id);
    const detail = await getMemberAction(id);
    setLoadingId(null);
    if (detail) setSelected(detail);
  }

  if (members.length === 0) {
    return <p className="mt-6 text-center text-sm text-[#666]">No {memberLabel.toLowerCase()}s match these filters.</p>;
  }

  return (
    <>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m) => {
          const proximity = m.university?.proximity ?? "Unknown";
          return (
            <button
              key={m.id}
              onClick={() => openMember(m.id)}
              disabled={loadingId === m.id}
              className="text-left rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] border-l-4 border-[#1e3a5f] p-4 hover:-translate-y-1 hover:shadow-[0_4px_15px_rgba(0,0,0,0.15)] transition-all disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="h-[50px] w-[50px] shrink-0 rounded-full bg-[#1e3a5f] text-white font-bold flex items-center justify-center">
                  {m.full_name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#333] truncate">
                    {m.full_name}
                    {m.is_visitor && (
                      <span className="ml-2 rounded-full bg-[#e2e3e5] text-[#383d41] text-[10px] px-2 py-0.5 align-middle">
                        Visitor
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#666] truncate">
                    {m.university?.name ?? "—"}
                    {m.program_of_study ? ` · ${m.program_of_study}` : ""}
                  </p>
                  {m.phone && <p className="text-xs text-[#666]">{m.phone}</p>}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PROXIMITY_BADGE[proximity]}`}>
                  {proximity}
                </span>
                <span className="text-[11px] text-[#666]">
                  {m.assigned_servant?.full_name ?? "Unassigned"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <MemberDetailModal
          member={selected}
          groupId={groupId}
          universities={universities}
          servants={servants}
          memberLabel={memberLabel}
          canDelete={canDelete}
          onClose={() => setSelected(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}

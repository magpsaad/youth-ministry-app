"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ServantOption } from "@/lib/servants";
import { assignServantAction } from "@/app/g/[groupId]/members/actions";

export function AssignServantSelect({
  memberId,
  groupId,
  memberGender,
  servants,
}: {
  memberId: string;
  groupId: string;
  memberGender: string | null;
  servants: ServantOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const sorted = [...servants].sort((a, b) => {
    const aMatch = a.gender === memberGender ? 0 : 1;
    const bMatch = b.gender === memberGender ? 0 : 1;
    return aMatch - bMatch || a.full_name.localeCompare(b.full_name);
  });

  return (
    <select
      defaultValue=""
      disabled={pending}
      onChange={(e) => {
        if (!e.target.value) return;
        startTransition(async () => {
          await assignServantAction(memberId, groupId, e.target.value);
          router.refresh();
        });
      }}
      className="rounded-md border border-[#ddd] px-2 py-1.5 text-xs focus:border-[#1e3a5f] focus:outline-none"
    >
      <option value="" disabled>
        {pending ? "Assigning…" : "Assign to…"}
      </option>
      {sorted.map((s) => (
        <option key={s.id} value={s.id}>
          {s.full_name} (has {s.caseload})
        </option>
      ))}
    </select>
  );
}

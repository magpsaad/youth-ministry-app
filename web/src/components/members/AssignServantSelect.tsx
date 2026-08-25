"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ServantOption } from "@/lib/servants";
import { assignServantAction } from "@/app/g/[groupId]/members/actions";

/** REQUIREMENTS.md §6.3 -- the New Registrations quick-assign dropdown hard-
 * filters to matching-gender servants (confirmed against the current app's
 * actual behavior for this specific widget -- unlike the Member Detail
 * modal's assignment dropdown, which only soft-sorts by gender). */
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

  const matching = servants
    .filter((s) => !memberGender || s.gender === memberGender)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

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
        {pending ? "Assigning…" : "Assign Servant"}
      </option>
      {matching.map((s) => (
        <option key={s.id} value={s.id}>
          {s.full_name} (has {s.caseload})
        </option>
      ))}
    </select>
  );
}

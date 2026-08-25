"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MemberDetail } from "@/lib/members";
import type { University } from "@/lib/universities";
import type { ServantOption } from "@/lib/servants";
import { getMemberAction } from "@/app/g/[groupId]/members/data-actions";
import { MemberDetailModal } from "./MemberDetailModal";

/** Wraps any trigger element (a name, a card, ...) so clicking it opens the
 * Member Detail modal -- reused from the Member List grid, Dashboard's
 * Birthdays and New Registrations sections, and anywhere else a member
 * needs to be one click away. */
export function MemberDetailLink({
  memberId,
  groupId,
  universities,
  servants,
  memberLabel,
  canDelete,
  currentUserName,
  className,
  children,
}: {
  memberId: string;
  groupId: string;
  universities: University[];
  servants: ServantOption[];
  memberLabel: string;
  canDelete: boolean;
  currentUserName: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    const d = await getMemberAction(memberId);
    setLoading(false);
    if (d) setDetail(d);
  }

  return (
    <>
      <button type="button" onClick={open} disabled={loading} className={className}>
        {children}
      </button>
      {detail && (
        <MemberDetailModal
          member={detail}
          groupId={groupId}
          universities={universities}
          servants={servants}
          memberLabel={memberLabel}
          canDelete={canDelete}
          currentUserName={currentUserName}
          onClose={() => setDetail(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}

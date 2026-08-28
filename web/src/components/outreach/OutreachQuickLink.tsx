"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddOutreachModal } from "./AddOutreachModal";

/** REQUIREMENTS.md §6.6 -- always prefills the *current user* as servant,
 * even when launched as a quick-link from Dashboard sections, not the
 * member's assigned servant. */
export function OutreachQuickLink({
  memberId,
  memberName,
  memberPhone,
  memberLabel,
  groupId,
  currentUserName,
  className,
}: {
  memberId: string;
  memberName: string;
  memberPhone?: string | null;
  memberLabel?: string;
  groupId: string;
  currentUserName: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Outreach
      </button>
      {open && (
        <AddOutreachModal
          memberId={memberId}
          memberName={memberName}
          memberPhone={memberPhone}
          memberLabel={memberLabel}
          groupId={groupId}
          currentUserName={currentUserName}
          onClose={() => setOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}

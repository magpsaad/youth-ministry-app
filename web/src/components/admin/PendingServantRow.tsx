"use client";

import { useState, useTransition } from "react";
import type { PendingServant } from "@/lib/pending-servants";
import { approvePendingServantAction } from "@/app/admin/pending-servants/actions";

export function PendingServantRow({ servant }: { servant: PendingServant }) {
  const [pending, startTransition] = useTransition();
  const [approved, setApproved] = useState(!!servant.approved_at);
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approvePendingServantAction(servant.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setApproved(true);
    });
  }

  return (
    <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-[#1e3a5f]">{servant.full_name}</p>
        <p className="text-xs text-[#666]">
          {servant.phone ?? "—"} · {servant.email ?? "—"} · {servant.gender ?? "—"}
        </p>
        {servant.father_of_confession && (
          <p className="text-xs text-[#666]">Father of Confession: {servant.father_of_confession}</p>
        )}
        {servant.registration_comments && <p className="text-xs text-[#666] italic">&ldquo;{servant.registration_comments}&rdquo;</p>}
        <p className="text-xs text-[#999] mt-1">
          First registered {new Date(servant.submitted_at).toLocaleDateString()} · checked in {servant.checkInCount}{" "}
          time{servant.checkInCount === 1 ? "" : "s"}
        </p>
        {error && <p className="text-xs text-[#dc3545] mt-1">{error}</p>}
      </div>
      {approved ? (
        <span className="shrink-0 rounded-full bg-[#d4edda] text-[#155724] text-xs font-semibold px-3 py-1.5">
          Approved — waiting for them to sign in
        </span>
      ) : (
        <button
          type="button"
          onClick={handleApprove}
          disabled={pending}
          className="shrink-0 rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
        >
          {pending ? "Approving…" : "Approve"}
        </button>
      )}
    </div>
  );
}

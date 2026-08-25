"use client";

import { useMemo, useState } from "react";
import type { CheckInPerson } from "@/lib/checkin";
import type { University } from "@/lib/universities";
import { markMemberAttendanceAction, markServantAttendanceAction } from "@/app/checkin/actions";
import { MemberIntakeForm } from "./MemberIntakeForm";
import { ServantIntakeForm } from "./ServantIntakeForm";

type View = "list" | "member-intake" | "servant-intake" | "success";

/** REQUIREMENTS.md §6.11/§6.12 -- the public no-login check-in page. One
 * component drives both flows (member group QR, and the "Servants" QR
 * added in Phase C) since they're structurally identical: search, tap your
 * name, done -- or "don't see your name?" into an intake form. */
export function CheckInFlow({
  token,
  isServant,
  flowType,
  initialPeople,
  universities,
  memberLabel,
}: {
  token: string;
  isServant: boolean;
  flowType: "check_in_and_intake" | "intake_only";
  initialPeople: CheckInPerson[];
  universities: University[];
  memberLabel: string;
}) {
  const [view, setView] = useState<View>(
    flowType === "intake_only" ? (isServant ? "servant-intake" : "member-intake") : "list",
  );
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return initialPeople;
    return initialPeople.filter((p) => p.full_name.toLowerCase().includes(needle));
  }, [q, initialPeople]);

  async function handleSelect(person: CheckInPerson) {
    setPending(true);
    setError(null);
    const result = isServant
      ? await markServantAttendanceAction(token, person.id, person.kind === "pending" ? "pending" : "servant")
      : await markMemberAttendanceAction(token, person.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccessName(person.full_name);
    setView("success");
  }

  function handleIntakeSubmitted(name: string) {
    setSuccessName(name);
    setView("success");
  }

  if (view === "success") {
    return (
      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-6 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="mt-2 text-lg font-bold text-[#1e3a5f]">You&rsquo;re checked in, {successName}!</h2>
        <p className="mt-1 text-sm text-[#666]">See you inside.</p>
      </div>
    );
  }

  if (view === "member-intake") {
    return (
      <MemberIntakeForm
        token={token}
        universities={universities}
        memberLabel={memberLabel}
        onBack={flowType === "check_in_and_intake" ? () => setView("list") : undefined}
        onSubmitted={handleIntakeSubmitted}
      />
    );
  }

  if (view === "servant-intake") {
    return (
      <ServantIntakeForm
        token={token}
        onBack={flowType === "check_in_and_intake" ? () => setView("list") : undefined}
        onSubmitted={handleIntakeSubmitted}
      />
    );
  }

  return (
    <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4">
      <input
        autoFocus
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your name…"
        className="w-full rounded-md border border-[#ddd] px-3 py-3 text-base focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10"
      />
      {error && <p className="mt-2 text-sm text-[#dc3545]">{error}</p>}
      <div className="mt-3 max-h-[50vh] overflow-y-auto divide-y divide-[#f0f0f0]">
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            onClick={() => handleSelect(p)}
            className="w-full text-left px-2 py-3 text-[#333] hover:bg-[#f5f5f5] disabled:opacity-50"
          >
            {p.full_name}
          </button>
        ))}
        {filtered.length === 0 && <p className="px-2 py-3 text-sm text-[#666]">No match.</p>}
      </div>
      <button
        type="button"
        onClick={() => setView(isServant ? "servant-intake" : "member-intake")}
        className="mt-3 w-full rounded-md bg-[#f0f0f0] px-4 py-3 text-sm font-semibold text-[#333] hover:bg-[#e0e0e0]"
      >
        Don&rsquo;t see your name? Register here
      </button>
    </div>
  );
}

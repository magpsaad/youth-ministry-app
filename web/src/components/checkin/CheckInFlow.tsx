"use client";

import { useMemo, useState } from "react";
import type { CheckInPerson } from "@/lib/checkin";
import type { University } from "@/lib/universities";
import {
  markMemberAttendanceAction,
  markServantAttendanceAction,
  undoMemberAttendanceAction,
  undoServantAttendanceAction,
  type MissingMemberFields,
} from "@/app/checkin/actions";
import { MemberIntakeForm } from "./MemberIntakeForm";
import { ServantIntakeForm } from "./ServantIntakeForm";
import { MissingFieldsForm } from "./MissingFieldsForm";

const NO_MISSING_FIELDS: MissingMemberFields = {
  phone: false,
  email: false,
  university: false,
  program: false,
  dob: false,
  fatherOfConfession: false,
};

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
  serviceDayName,
}: {
  token: string;
  isServant: boolean;
  flowType: "check_in_and_intake" | "intake_only";
  initialPeople: CheckInPerson[];
  universities: University[];
  memberLabel: string;
  /** Owner-reported: the "check back this Friday" message was hardcoded to
   * "Friday" regardless of the actually-configured service day. */
  serviceDayName: string;
}) {
  const [view, setView] = useState<View>(
    flowType === "intake_only" ? (isServant ? "servant-intake" : "member-intake") : "list",
  );
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);
  const [attendanceRecorded, setAttendanceRecorded] = useState(true);
  const [wasNewRegistration, setWasNewRegistration] = useState(false);
  // Owner-reported: a self-check-in mis-tap (wrong name, right next to the
  // intended one) had no way to be undone. The success screen already
  // shows the checked-in name -- a mis-tap is immediately visible there --
  // so rather than a confirm-before-every-tap dialog (friction on every
  // single check-in to guard a rare mistake), this adds a "Not you? Undo"
  // action on that screen instead. checkedInPerson carries what's needed
  // to call the matching undo action; canUndo is only true when this tap
  // actually created today's record (never when it already existed --
  // e.g. someone else already checked this person in), so undo can never
  // remove a record this tap didn't create. Only wired up for the tap-a-
  // name list, not the "don't see your name?" registration flow, which is
  // out of scope here.
  const [checkedInPerson, setCheckedInPerson] = useState<CheckInPerson | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);
  // Owner-requested: right after "Not you? Undo", offer to fill in whichever
  // of this member's own fields are currently blank. Member/youth flow only
  // -- never shown for servants, and never after a fresh registration (the
  // intake form just collected everything already).
  const [missingFields, setMissingFields] = useState<MissingMemberFields>(NO_MISSING_FIELDS);
  const [showMissingFields, setShowMissingFields] = useState(false);

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
    setAttendanceRecorded(result.attendanceRecorded);
    setWasNewRegistration(false);
    setCheckedInPerson(person);
    setCanUndo(result.attendanceRecorded && result.newlyCreated);
    if (!isServant) {
      const memberResult = result as Awaited<ReturnType<typeof markMemberAttendanceAction>>;
      setMissingFields(memberResult.missingFields);
      setShowMissingFields(true);
    } else {
      setMissingFields(NO_MISSING_FIELDS);
      setShowMissingFields(false);
    }
    setView("success");
  }

  function handleIntakeSubmitted(name: string, recorded: boolean) {
    setSuccessName(name);
    setAttendanceRecorded(recorded);
    setWasNewRegistration(true);
    setCheckedInPerson(null);
    setCanUndo(false);
    setMissingFields(NO_MISSING_FIELDS);
    setShowMissingFields(false);
    setView("success");
  }

  async function handleUndo() {
    if (!checkedInPerson) return;
    setUndoing(true);
    setError(null);
    const result = isServant
      ? await undoServantAttendanceAction(token, checkedInPerson.id, checkedInPerson.kind === "pending" ? "pending" : "servant")
      : await undoMemberAttendanceAction(token, checkedInPerson.id);
    setUndoing(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCheckedInPerson(null);
    setCanUndo(false);
    setMissingFields(NO_MISSING_FIELDS);
    setShowMissingFields(false);
    setView("list");
  }

  if (view === "success") {
    return (
      <div className="rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-6 text-center">
        <p className="text-3xl">{attendanceRecorded ? "✅" : "👋"}</p>
        <h2 className="mt-2 text-lg font-bold text-[#1e3a5f]">
          {attendanceRecorded ? `You’re checked in, ${successName}!` : `Thanks, ${successName}!`}
        </h2>
        <p className="mt-1 text-sm text-[#666]">
          {attendanceRecorded
            ? "See you inside."
            : wasNewRegistration
              ? "Attendance isn’t tracked today, but your registration is saved."
              : `Attendance isn’t tracked today — please check back this ${serviceDayName}.`}
        </p>
        {canUndo && (
          <>
            {error && <p className="mt-3 text-sm text-[#dc3545]">{error}</p>}
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoing}
              className="mt-4 text-base font-bold text-[#dc3545] underline hover:text-[#c82333] disabled:opacity-50"
            >
              {undoing ? "Removing…" : "Not you? Undo"}
            </button>
          </>
        )}
        {!isServant && showMissingFields && checkedInPerson && (
          <MissingFieldsForm
            token={token}
            memberId={checkedInPerson.id}
            missing={missingFields}
            universities={universities}
            onDone={() => setShowMissingFields(false)}
          />
        )}
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
    <div className="rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-4">
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
        className="mt-3 w-full rounded-md bg-[#f0f0f0] px-4 py-3 text-sm font-semibold text-[#333] hover:bg-[#e0e0e0] shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
      >
        Don&rsquo;t see your name? Register here
      </button>
    </div>
  );
}

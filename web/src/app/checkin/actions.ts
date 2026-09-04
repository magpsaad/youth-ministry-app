"use server";

import { createClient } from "@/lib/supabase/server";

/** Normalizes any phone input to `1 (416) 930-1659` -- REQUIREMENTS.md §6.11
 * item 6. Leaves anything that isn't a recognizable 10/11-digit North
 * American number untouched rather than guessing. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return raw.trim();
  return `1 (${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Server-side backstop for the client-side checks in the intake forms --
 * mandatory Name/Phone/Email/Gender, Name >=2 words, valid phone digit
 * count, valid email shape. Everything else stays free-form. */
function validateIntake(input: { full_name: string; phone: string | null; email: string | null; gender: string | null }): string | null {
  if (!input.full_name.trim() || input.full_name.trim().split(/\s+/).length < 2) {
    return "Please enter your first and last name.";
  }
  const digits = (input.phone ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) {
    return "Please enter a valid phone number.";
  }
  if (!input.email || !EMAIL_RE.test(input.email.trim())) {
    return "Please enter a valid email address.";
  }
  if (!input.gender) {
    return "Please select a gender.";
  }
  return null;
}

export type MissingMemberFields = {
  phone: boolean;
  email: boolean;
  university: boolean;
  program: boolean;
  dob: boolean;
  fatherOfConfession: boolean;
};

/** `newlyCreated` distinguishes "this tap actually created today's
 * attendance record" from "today's record already existed" (someone else
 * already checked this person in, or a coordinator marked it manually) --
 * the client only offers "Not you? Undo" when it's true, since undoing an
 * already-existing record would remove something this tap didn't create.
 *
 * `missingFields` (owner-requested) tells the client which of Phone/Email/
 * University/Program/DOB/Father of Confession are currently blank on this
 * member's record -- computed server-side so the client never has to
 * receive (and could never accidentally display) the record's real values
 * to figure this out itself. */
export async function markMemberAttendanceAction(token: string, memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_mark_attendance", { p_token: token, p_member_id: memberId }).single();
  const row = data as {
    attendance_recorded: boolean;
    newly_created: boolean;
    missing_phone: boolean;
    missing_email: boolean;
    missing_university: boolean;
    missing_program: boolean;
    missing_dob: boolean;
    missing_father_of_confession: boolean;
  } | null;
  const missingFields: MissingMemberFields = {
    phone: row?.missing_phone ?? false,
    email: row?.missing_email ?? false,
    university: row?.missing_university ?? false,
    program: row?.missing_program ?? false,
    dob: row?.missing_dob ?? false,
    fatherOfConfession: row?.missing_father_of_confession ?? false,
  };
  return {
    error: error?.message ?? null,
    attendanceRecorded: row?.attendance_recorded ?? false,
    newlyCreated: row?.newly_created ?? false,
    missingFields,
  };
}

export type MissingFieldsInput = {
  phone: string | null;
  email: string | null;
  university_id: string | null;
  program_of_study: string | null;
  date_of_birth: string | null;
  father_of_confession: string | null;
};

/** Owner-requested: lets a youth fill in whichever of their own record's
 * blank fields are shown to them, right from the check-in success screen.
 * Only ever sends what they typed -- validation mirrors validateIntake's
 * per-field checks, but every field here is optional (skip validating
 * anything left blank), since they may only want to fill in some of what's
 * shown. The RPC itself is the real backstop: it only ever writes into a
 * field that's still genuinely blank, regardless of what's sent. */
export async function fillMissingMemberFieldsAction(token: string, memberId: string, input: MissingFieldsInput) {
  const phoneDigits = (input.phone ?? "").replace(/\D/g, "");
  if (input.phone && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
    return { error: "Please enter a valid phone number." };
  }
  if (input.email && !EMAIL_RE.test(input.email.trim())) {
    return { error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("checkin_fill_missing_member_fields", {
    p_token: token,
    p_member_id: memberId,
    p_phone: input.phone ? formatPhone(input.phone) : null,
    p_email: input.email?.trim() || null,
    p_university_id: input.university_id || null,
    p_program_of_study: input.program_of_study?.trim() || null,
    p_date_of_birth: input.date_of_birth || null,
    p_father_of_confession: input.father_of_confession?.trim() || null,
  });
  return { error: error?.message ?? null };
}

/** Mis-tap recovery for the self-check-in list (owner-reported: a wrong tap
 * had no way to be undone). Only removes a record checkin_mark_attendance
 * itself created within the last couple minutes (see migration 0046) --
 * never something pre-existing. */
export async function undoMemberAttendanceAction(token: string, memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("checkin_undo_attendance", { p_token: token, p_member_id: memberId });
  return { error: error?.message ?? null };
}

export type NewMemberInput = {
  full_name: string;
  phone: string | null;
  email: string | null;
  university_id: string | null;
  program_of_study: string | null;
  date_of_birth: string | null;
  father_of_confession: string | null;
  home_address: string | null;
  gender: string | null;
  comments: string | null;
};

export async function submitNewMemberAction(token: string, input: NewMemberInput) {
  const validationError = validateIntake(input);
  if (validationError) return { error: validationError, attendanceRecorded: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("checkin_submit_new_member", {
      p_token: token,
      p_full_name: input.full_name.trim(),
      p_phone: formatPhone(input.phone ?? ""),
      p_email: input.email?.trim() ?? null,
      p_university_id: input.university_id,
      p_program_of_study: input.program_of_study,
      p_date_of_birth: input.date_of_birth,
      p_father_of_confession: input.father_of_confession,
      p_home_address: input.home_address,
      p_gender: input.gender,
      p_comments: input.comments,
    })
    .single();

  if (error) return { error: error.message, attendanceRecorded: false };
  const row = data as { member_id: string; attendance_recorded: boolean } | null;
  return { error: null, attendanceRecorded: row?.attendance_recorded ?? false };
}

export async function markServantAttendanceAction(token: string, id: string, kind: "servant" | "pending") {
  const supabase = await createClient();
  const { data, error } =
    kind === "servant"
      ? await supabase.rpc("checkin_mark_servant_attendance", { p_token: token, p_servant_id: id }).single()
      : await supabase.rpc("checkin_mark_pending_servant_attendance", { p_token: token, p_pending_servant_id: id }).single();
  const row = data as { attendance_recorded: boolean; newly_created: boolean } | null;
  return { error: error?.message ?? null, attendanceRecorded: row?.attendance_recorded ?? false, newlyCreated: row?.newly_created ?? false };
}

/** Same mis-tap recovery as undoMemberAttendanceAction, for the Servants QR. */
export async function undoServantAttendanceAction(token: string, id: string, kind: "servant" | "pending") {
  const supabase = await createClient();
  const { error } =
    kind === "servant"
      ? await supabase.rpc("checkin_undo_servant_attendance", { p_token: token, p_servant_id: id })
      : await supabase.rpc("checkin_undo_pending_servant_attendance", { p_token: token, p_pending_servant_id: id });
  return { error: error?.message ?? null };
}

export type NewServantInput = {
  full_name: string;
  phone: string | null;
  email: string | null;
  father_of_confession: string | null;
  gender: string | null;
  comments: string | null;
};

export async function submitNewServantAction(token: string, input: NewServantInput) {
  const validationError = validateIntake(input);
  if (validationError) return { error: validationError, attendanceRecorded: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("checkin_submit_new_servant", {
      p_token: token,
      p_full_name: input.full_name.trim(),
      p_phone: formatPhone(input.phone ?? ""),
      p_email: input.email?.trim() ?? null,
      p_father_of_confession: input.father_of_confession,
      p_gender: input.gender,
      p_comments: input.comments,
    })
    .single();

  if (error) return { error: error.message, attendanceRecorded: false };
  const row = data as { pending_id: string; attendance_recorded: boolean } | null;
  return { error: null, attendanceRecorded: row?.attendance_recorded ?? false };
}

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

export async function markMemberAttendanceAction(token: string, memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_mark_attendance", { p_token: token, p_member_id: memberId });
  return { error: error?.message ?? null, attendanceRecorded: (data as boolean | null) ?? false };
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
      ? await supabase.rpc("checkin_mark_servant_attendance", { p_token: token, p_servant_id: id })
      : await supabase.rpc("checkin_mark_pending_servant_attendance", { p_token: token, p_pending_servant_id: id });
  return { error: error?.message ?? null, attendanceRecorded: (data as boolean | null) ?? false };
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

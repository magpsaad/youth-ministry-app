"use server";

import { createClient } from "@/lib/supabase/server";

export async function markMemberAttendanceAction(token: string, memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("checkin_mark_attendance", { p_token: token, p_member_id: memberId });
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
  const supabase = await createClient();
  const { error } = await supabase.rpc("checkin_submit_new_member", {
    p_token: token,
    p_full_name: input.full_name,
    p_phone: input.phone,
    p_email: input.email,
    p_university_id: input.university_id,
    p_program_of_study: input.program_of_study,
    p_date_of_birth: input.date_of_birth,
    p_father_of_confession: input.father_of_confession,
    p_home_address: input.home_address,
    p_gender: input.gender,
    p_comments: input.comments,
  });
  return { error: error?.message ?? null };
}

export async function markServantAttendanceAction(token: string, id: string, kind: "servant" | "pending") {
  const supabase = await createClient();
  const { error } =
    kind === "servant"
      ? await supabase.rpc("checkin_mark_servant_attendance", { p_token: token, p_servant_id: id })
      : await supabase.rpc("checkin_mark_pending_servant_attendance", { p_token: token, p_pending_servant_id: id });
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
  const supabase = await createClient();
  const { error } = await supabase.rpc("checkin_submit_new_servant", {
    p_token: token,
    p_full_name: input.full_name,
    p_phone: input.phone,
    p_email: input.email,
    p_father_of_confession: input.father_of_confession,
    p_gender: input.gender,
    p_comments: input.comments,
  });
  return { error: error?.message ?? null };
}

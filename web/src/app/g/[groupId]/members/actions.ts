"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateMemberInput = {
  phone: string | null;
  email: string | null;
  university_id: string | null;
  program_of_study: string | null;
  date_of_birth: string | null;
  father_of_confession: string | null;
  home_address: string | null;
  gender: string | null;
  servant_comments: string | null;
};

/** Full Name and Registration Comments are always read-only (REQUIREMENTS.md §6.4) -- never accepted here. */
export async function updateMemberAction(memberId: string, groupId: string, input: UpdateMemberInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("members").update(input).eq("id", memberId);
  if (error) return { error: error.message };

  revalidatePath(`/g/${groupId}/members`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

/** Admin-only correction tool (RLS enforces this regardless of the UI) -- REQUIREMENTS.md §3.3.1. */
export async function deleteMemberAction(memberId: string, groupId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("members").delete().eq("id", memberId);
  if (error) return { error: error.message };

  revalidatePath(`/g/${groupId}/members`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

/** Assigning a member to a servant also clears the "new assignment" flag it may have just set. */
export async function assignServantAction(memberId: string, groupId: string, servantId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ assigned_servant_id: servantId, is_new_assignment: false })
    .eq("id", memberId);
  if (error) return { error: error.message };

  revalidatePath(`/g/${groupId}/members`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

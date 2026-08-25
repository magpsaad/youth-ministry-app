"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { photosBucket } from "@/lib/storage";

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
  is_visitor: boolean;
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

/** General Coordinator / Admin only -- correction tool for mistaken/test
 * records (RLS enforces this regardless of the UI; REQUIREMENTS.md §3.3.1
 * widened from Admin-only per owner request, see the accompanying migration). */
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

/** Upload/replace a member's photo -- available to any user with access to
 * this member (not admin-restricted, REQUIREMENTS.md §6.4). No cropping yet
 * (the current app's Cropper.js step) -- uploads the picked/captured file
 * as-is; cropping/resizing is a reasonable follow-up polish item. */
export async function uploadMemberPhotoAction(memberId: string, groupId: string, formData: FormData) {
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };

  const supabase = await createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${memberId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(photosBucket())
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error: updateError } = await supabase.from("members").update({ photo_path: path }).eq("id", memberId);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/g/${groupId}/members`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

export async function removeMemberPhotoAction(memberId: string, groupId: string, photoPath: string) {
  const supabase = await createClient();
  const { error: removeError } = await supabase.storage.from(photosBucket()).remove([photoPath]);
  if (removeError) return { error: removeError.message };

  const { error } = await supabase.from("members").update({ photo_path: null }).eq("id", memberId);
  if (error) return { error: error.message };

  revalidatePath(`/g/${groupId}/members`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

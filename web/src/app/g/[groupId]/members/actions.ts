"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { photosBucket } from "@/lib/storage";
import { logAudit } from "@/lib/audit";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("members").update(input).eq("id", memberId);
  if (error) return { error: error.message };

  if (user) await logAudit(user.id, "MEMBER_EDITED", { groupId, details: { memberId } });
  revalidatePath(`/g/${groupId}/members`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

/** General Coordinator / Admin only -- correction tool for mistaken/test
 * records (RLS enforces this regardless of the UI; REQUIREMENTS.md §3.3.1
 * widened from Admin-only per owner request, see the accompanying migration). */
export async function deleteMemberAction(memberId: string, groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("members").delete().eq("id", memberId);
  if (error) return { error: error.message };

  if (user) await logAudit(user.id, "MEMBER_DELETED", { groupId, details: { memberId } });
  revalidatePath(`/g/${groupId}/members`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

/** Assigning a member to a servant sets `is_new_assignment` so the member
 * surfaces under that servant's Actions Needed list until the servant
 * either outreaches them (auto-cleared by migration 0029's trigger) or
 * dismisses the card (dismissNewAssignmentAction). Unassigning (servantId
 * null) always clears the flag -- there's no servant left to notify. */
export async function assignServantAction(memberId: string, groupId: string, servantId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("members")
    .update({ assigned_servant_id: servantId, is_new_assignment: servantId !== null })
    .eq("id", memberId);
  if (error) return { error: error.message };

  if (user) await logAudit(user.id, "SERVANT_ASSIGNED", { groupId, details: { memberId, servantId } });
  revalidatePath(`/g/${groupId}/members`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

/** REQUIREMENTS.md §6.3/§7.1 -- manually dismisses a "Newly Assigned" Actions
 * Needed card without requiring an outreach entry. Persistent (a DB column,
 * not sessionStorage) since the card should stay gone across sessions. */
export async function dismissNewAssignmentAction(memberId: string, groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("members").update({ is_new_assignment: false }).eq("id", memberId);
  if (error) return { error: error.message };

  if (user) await logAudit(user.id, "MEMBER_EDITED", { groupId, details: { memberId, action: "new_assignment_dismissed" } });
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

/** Upload/replace a member's photo -- available to any user with access to
 * this member (not admin-restricted, REQUIREMENTS.md §6.4). No cropping yet
 * (the current app's Cropper.js step) -- uploads the picked/captured file
 * as-is; cropping/resizing is a reasonable follow-up polish item.
 *
 * Each upload gets a unique path (timestamped) rather than overwriting the
 * previous one at a fixed `{memberId}.{ext}` path -- reusing the same path
 * produced the same public URL, which the browser/CDN would keep serving
 * from cache even after the underlying file changed, making "replace" look
 * like a no-op. The old file is removed after the new one is confirmed live. */
export async function uploadMemberPhotoAction(memberId: string, groupId: string, formData: FormData) {
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${memberId}-${Date.now()}.${ext}`;

  const { data: existing } = await supabase.from("members").select("photo_path").eq("id", memberId).maybeSingle();

  const { error: uploadError } = await supabase.storage
    .from(photosBucket())
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error: updateError } = await supabase.from("members").update({ photo_path: path }).eq("id", memberId);
  if (updateError) return { error: updateError.message };

  if (existing?.photo_path && existing.photo_path !== path) {
    await supabase.storage.from(photosBucket()).remove([existing.photo_path]);
  }

  if (user) await logAudit(user.id, "MEMBER_PHOTO_UPLOADED", { groupId, details: { memberId } });
  revalidatePath(`/g/${groupId}/members`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null, photoPath: path };
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

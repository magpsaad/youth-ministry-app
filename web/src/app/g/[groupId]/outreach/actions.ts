"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMemberOutreach, getOutreachEntries, type OutreachEntry, type OutreachEntryFull } from "@/lib/outreach";
import { logAudit } from "@/lib/audit";

export async function getMemberOutreachAction(memberId: string): Promise<OutreachEntry[]> {
  return getMemberOutreach(memberId);
}

export async function getOutreachEntriesAction(groupId: string): Promise<OutreachEntryFull[]> {
  return getOutreachEntries(groupId);
}

export type AddOutreachInput = {
  member_id: string;
  occurred_at: string; // ISO datetime
  type: string | null;
  notes: string | null;
  follow_up_due: string | null;
};

/** Servant always defaults to the current user (REQUIREMENTS.md §6.6), even
 * when launched as a "quick outreach" from Birthdays/Member Detail rather
 * than not the member's assigned servant. */
export async function addOutreachEntryAction(groupId: string, input: AddOutreachInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("outreach_entries").insert({
    member_id: input.member_id,
    servant_id: user.id,
    occurred_at: input.occurred_at,
    type: input.type,
    notes: input.notes,
    follow_up_due: input.follow_up_due,
  });
  if (error) return { error: error.message };

  await logAudit(user.id, "OUTREACH_ADDED", { groupId, details: { memberId: input.member_id } });
  revalidatePath(`/g/${groupId}/dashboard`);
  revalidatePath(`/g/${groupId}/outreach`);
  return { error: null };
}

export type EditOutreachInput = {
  occurred_at: string;
  type: string | null;
  notes: string | null;
  follow_up_due: string | null;
};

/** RLS restricts this to the entry's own creator regardless of what the UI
 * shows (REQUIREMENTS.md §6.6 -- "only the creator sees Edit/Delete"). */
export async function updateOutreachEntryAction(groupId: string, entryId: string, input: EditOutreachInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("outreach_entries")
    .update({
      occurred_at: input.occurred_at,
      type: input.type,
      notes: input.notes,
      follow_up_due: input.follow_up_due,
    })
    .eq("id", entryId);
  if (error) return { error: error.message };

  if (user) await logAudit(user.id, "OUTREACH_UPDATED", { groupId, details: { entryId } });
  revalidatePath(`/g/${groupId}/outreach`);
  return { error: null };
}

export async function deleteOutreachEntryAction(groupId: string, entryId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("outreach_entries").delete().eq("id", entryId);
  if (error) return { error: error.message };

  if (user) await logAudit(user.id, "OUTREACH_DELETED", { groupId, details: { entryId } });
  revalidatePath(`/g/${groupId}/outreach`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

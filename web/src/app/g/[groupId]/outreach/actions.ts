"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMemberOutreach, type OutreachEntry } from "@/lib/outreach";

export async function getMemberOutreachAction(memberId: string): Promise<OutreachEntry[]> {
  return getMemberOutreach(memberId);
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

  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

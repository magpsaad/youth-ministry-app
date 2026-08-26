"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

/**
 * REQUIREMENTS.md §6.1 -- a random active verse, shown while a group's data
 * loads. Returns null gracefully if the verses list is empty (nothing seeded
 * yet) rather than erroring.
 */
export async function getRandomVerseAction(): Promise<{ text: string; reference: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("verses")
    .select("text, reference")
    .eq("is_active", true);

  if (!data || data.length === 0) return null;
  return data[Math.floor(Math.random() * data.length)];
}

/** REQUIREMENTS.md §3.11 -- logged when a group's data is actually loaded
 * from the landing page (not just selected in the dropdown). */
export async function logGroupSelectedAction(groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await logAudit(user.id, "GROUP_SELECTED", { groupId });
}

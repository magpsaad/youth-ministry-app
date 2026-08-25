"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Marks a self-registered servant approved -- the account itself is created
 * automatically the first time that real person signs into the app (see
 * ensure-profile.ts / link_approved_pending_servant), not here. */
export async function approvePendingServantAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("pending_servants")
    .update({ approved_at: new Date().toISOString(), approved_by: user?.id ?? null })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/pending-servants");
  return { error: null };
}

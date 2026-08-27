"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

/** General Coordinator/Admin only -- enforced by the reassign_servant_group
 * RPC itself (security definer, checks is_admin_or_general_coordinator()),
 * not just the UI. Passing groupId=null unassigns the servant. */
export async function reassignServantGroupAction(servantId: string, groupId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.rpc("reassign_servant_group", { p_user_id: servantId, p_group_id: groupId });
  if (error) return { error: error.message };

  await logAudit(user.id, "SERVANT_GROUP_UPDATED", { groupId, details: { servantId } });
  revalidatePath("/servant-assignments");
  return { error: null };
}

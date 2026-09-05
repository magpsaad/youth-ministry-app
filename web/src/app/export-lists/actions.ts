"use server";

import { createClient } from "@/lib/supabase/server";

/** Owner-requested: names only, nothing else from the profile/member record
 * -- every query below selects exactly one column, on purpose, so there's
 * never any other field to accidentally include in an export. */

export async function getGroupMemberNamesAction(groupId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("full_name")
    .eq("group_id", groupId)
    .eq("status", "active")
    .order("full_name");
  return (data ?? []).map((r) => r.full_name);
}

/** Same "servant" definition as the Servant Directory (holds a 'servant',
 * 'sub_coordinator', or 'general_coordinator' role row) -- just names, no
 * attendance/contact/etc. */
export async function getServantNamesAction(): Promise<string[]> {
  const supabase = await createClient();
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["servant", "sub_coordinator", "general_coordinator"]);

  const userIds = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
  if (userIds.length === 0) return [];

  const { data: profileRows } = await supabase.from("profiles").select("full_name").in("id", userIds);
  return (profileRows ?? []).map((r) => r.full_name).sort((a, b) => a.localeCompare(b));
}

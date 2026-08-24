import { createClient } from "@/lib/supabase/server";

export type ServantOption = {
  id: string;
  full_name: string;
  gender: string | null;
  caseload: number;
};

/**
 * Servants who hold the `servant` role for this specific group -- i.e. who
 * should appear in that group's assignment dropdown (REQUIREMENTS.md §4.1).
 * Caseload = how many active members in this group are already assigned to
 * them, shown so coordinators can balance assignments (matches the current
 * app's "(has N)" annotation).
 */
export async function getServantsForGroup(groupId: string): Promise<ServantOption[]> {
  const supabase = await createClient();

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id, profiles(id, full_name, gender)")
    .eq("group_id", groupId)
    .eq("role", "servant");

  const servants = (roleRows ?? [])
    .map((r) => r.profiles as unknown as { id: string; full_name: string; gender: string | null } | null)
    .filter((p): p is { id: string; full_name: string; gender: string | null } => p !== null);

  if (servants.length === 0) return [];

  const { data: members } = await supabase
    .from("members")
    .select("assigned_servant_id")
    .eq("group_id", groupId)
    .eq("status", "active")
    .not("assigned_servant_id", "is", null);

  const caseloadByServant = new Map<string, number>();
  for (const m of members ?? []) {
    if (!m.assigned_servant_id) continue;
    caseloadByServant.set(m.assigned_servant_id, (caseloadByServant.get(m.assigned_servant_id) ?? 0) + 1);
  }

  return servants
    .map((s) => ({ ...s, caseload: caseloadByServant.get(s.id) ?? 0 }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

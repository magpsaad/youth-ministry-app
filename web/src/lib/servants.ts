import { createClient } from "@/lib/supabase/server";

export type ServantOption = {
  id: string;
  full_name: string;
  gender: string | null;
  caseload: number;
  /** Which cohort(s) this person holds a 'servant' grant for -- always
   * populated (even for a single-group call, where it's just that one
   * group's own name), but only meaningfully shown once servants from
   * several cohorts are listed together (the "all cohorts" combined view's
   * Analytics table, REQUIREMENTS.md §6.7 addendum -- a person holding
   * Servant grants at more than one cohort has more than one name here). */
  groupNames: string[];
};

/**
 * Servants who hold the `servant` role for this group (or, when `groupId`
 * is an array, for any of several groups at once -- the "all cohorts"
 * combined view, REQUIREMENTS.md §6.1 addendum) -- i.e. who should appear
 * in that group's assignment dropdown (REQUIREMENTS.md §4.1). Caseload =
 * how many active members already assigned to them, across whichever
 * group(s) were asked for, shown so coordinators can balance assignments
 * (matches the current app's "(has N)" annotation).
 */
export async function getServantsForGroup(groupId: string | string[]): Promise<ServantOption[]> {
  const supabase = await createClient();

  let roleQuery = supabase.from("user_roles").select("user_id, profiles(id, full_name, gender), groups(name)").eq("role", "servant");
  roleQuery = Array.isArray(groupId) ? roleQuery.in("group_id", groupId) : roleQuery.eq("group_id", groupId);
  const { data: roleRows } = await roleQuery;

  const byId = new Map<string, { id: string; full_name: string; gender: string | null; groupNames: string[] }>();
  for (const r of roleRows ?? []) {
    const p = r.profiles as unknown as { id: string; full_name: string; gender: string | null } | null;
    if (!p) continue;
    const groupName = (r.groups as unknown as { name: string } | null)?.name;
    const existing = byId.get(p.id);
    if (existing) {
      if (groupName && !existing.groupNames.includes(groupName)) existing.groupNames.push(groupName);
    } else {
      byId.set(p.id, { id: p.id, full_name: p.full_name, gender: p.gender, groupNames: groupName ? [groupName] : [] });
    }
  }
  const servants = Array.from(byId.values());
  if (servants.length === 0) return [];

  let memberQuery = supabase.from("members").select("assigned_servant_id").eq("status", "active").not("assigned_servant_id", "is", null);
  memberQuery = Array.isArray(groupId) ? memberQuery.in("group_id", groupId) : memberQuery.eq("group_id", groupId);
  const { data: members } = await memberQuery;

  const caseloadByServant = new Map<string, number>();
  for (const m of members ?? []) {
    if (!m.assigned_servant_id) continue;
    caseloadByServant.set(m.assigned_servant_id, (caseloadByServant.get(m.assigned_servant_id) ?? 0) + 1);
  }

  return servants
    .map((s) => ({ ...s, caseload: caseloadByServant.get(s.id) ?? 0 }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

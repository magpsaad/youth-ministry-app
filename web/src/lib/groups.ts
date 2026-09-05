import { createClient } from "@/lib/supabase/server";
import type { AccessSummary } from "@/lib/roles";

export type GroupSummary = {
  id: string;
  name: string;
  ladder_position: number;
  is_terminal: boolean;
};

/**
 * Groups the current user can see, per RLS (REQUIREMENTS.md §2.2, §4.4):
 * Admins see every group including the hidden position-0 pre-entry cohort;
 * everyone else sees only groups they hold a role against. No extra
 * filtering needed here -- the database already enforces this.
 *
 * `is_terminal` used to be a generated column hardcoded to `ladder_position
 * >= 5` -- now that the ladder length is admin-configurable (§6.9, migration
 * 0030), "terminal" just means "whichever position is currently highest
 * among this set of active groups," computed here from the rows already
 * fetched rather than a fixed number.
 */
export async function getAccessibleGroups(): Promise<GroupSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("id, name, ladder_position")
    .eq("is_archived", false)
    .order("display_order");

  const rows = data ?? [];
  const terminalPosition = rows.length > 0 ? Math.max(...rows.map((g) => g.ladder_position)) : null;
  return rows.map((g) => ({ ...g, is_terminal: g.ladder_position === terminalPosition }));
}

/**
 * The "Load Youth Data for all cohorts" combined view's group set: every
 * serving cohort (ladder_position > 0) this user can see, per RLS -- same
 * `ladder_position > 0` exclusion the landing page's own group selector
 * already applies (the hidden position-0 pre-entry group stays Admin-only,
 * REQUIREMENTS.md §2.2). A General Coordinator gets literally every real
 * cohort; a Sub-Coordinator gets whichever ones they actually hold a role
 * at (RLS-filtered by getAccessibleGroups() itself, no extra filtering
 * needed here) -- so "all cohorts" always means "everything this specific
 * user can see," never a hardcoded ministry-wide list.
 */
export async function getCombinedGroups(): Promise<GroupSummary[]> {
  const groups = await getAccessibleGroups();
  return groups.filter((g) => g.ladder_position > 0);
}

/**
 * "Which cohorts can I load/export real member data for" -- narrower than
 * "which cohorts can I see the name of" (groups_select was widened to
 * is_app_user() in migration 0038, so getAccessibleGroups() alone now
 * returns every cohort to any app user). The actual `members` rows stay
 * RLS-gated to has_readonly_or_full_group_access(group_id), so a
 * Sub-Coordinator picking a cohort they don't hold a role at would just
 * silently get zero rows back -- this computes the narrower, real answer
 * up front instead: every non-Yr0 cohort for an Admin/General Coordinator,
 * or only the specific ones a Sub-Coordinator/Servant/Read-Only actually
 * holds a role at.
 */
export function filterSelectableGroups(groups: GroupSummary[], access: AccessSummary): GroupSummary[] {
  const hasFullGroupAccess = access.isAdmin || access.isGeneralCoordinator;
  const ownGroupIds = new Set(access.roles.map((r) => r.group_id).filter((id): id is string => id !== null));
  return groups.filter((g) => g.ladder_position > 0 && (hasFullGroupAccess || ownGroupIds.has(g.id)));
}

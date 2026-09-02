import { createClient } from "@/lib/supabase/server";

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

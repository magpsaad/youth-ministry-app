import { createClient } from "@/lib/supabase/server";

export type TransitionPreviewGroup = {
  id: string;
  name: string;
  cohortYear: number | null;
  ladderPosition: number;
  nextName: string | null; // null = this row is archived by the transition (the old terminal group)
};

export type TransitionPreview = {
  groups: TransitionPreviewGroup[];
  oldTerminalGroupName: string | null; // absorbed and archived this transition, if it exists
  newTerminalGroupName: string | null; // Yr 4's row, becoming the new terminal -- its computed next name
  suggestedNewCohortYear: number;
};

/** REQUIREMENTS.md §5 -- everything the Group Transition confirmation
 * screen needs to show before the Admin commits: every group's current vs.
 * next-name preview, which old terminal-tier row (if any) is about to be
 * absorbed and archived, and a suggested year for the new incoming
 * pre-entry cohort. Mirrors run_group_transition() (migration 0028)
 * exactly: Yr 4's row becomes the new terminal row (same row, aggregate
 * name); the OLD terminal row is what merges in and archives. */
export async function getTransitionPreview(): Promise<TransitionPreview> {
  const supabase = await createClient();

  const [{ data: groupRows }, { data: settings }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, cohort_year, ladder_position")
      .eq("is_archived", false)
      .order("ladder_position"),
    supabase.from("app_settings").select("group_name_template").single(),
  ]);

  const template = settings?.group_name_template ?? "{cohort_year} Cohort - Yr {position_label}";
  const rows = groupRows ?? [];

  function renderName(cohortYear: number | null, positionLabel: string) {
    if (cohortYear === null) return null;
    return template.replace("{cohort_year}", String(cohortYear)).replace("{position_label}", positionLabel);
  }

  const groups: TransitionPreviewGroup[] = rows.map((g) => {
    if (g.ladder_position === 5) {
      // The OLD terminal row -- absorbed into Yr 4's row and archived this transition.
      return { id: g.id, name: g.name, cohortYear: g.cohort_year, ladderPosition: g.ladder_position, nextName: null };
    }
    if (g.ladder_position === 4) {
      // Becomes the NEW terminal row -- aggregate name, not the normal template.
      const nextName = g.cohort_year !== null ? `${g.cohort_year} and earlier - Yr 5+` : null;
      return { id: g.id, name: g.name, cohortYear: g.cohort_year, ladderPosition: g.ladder_position, nextName };
    }
    const nextName = renderName(g.cohort_year, String(g.ladder_position + 1));
    return { id: g.id, name: g.name, cohortYear: g.cohort_year, ladderPosition: g.ladder_position, nextName };
  });

  const oldTerminal = rows.find((g) => g.ladder_position === 5);
  const newTerminal = rows.find((g) => g.ladder_position === 4);
  const currentPreEntry = rows.find((g) => g.ladder_position === 0);
  const suggestedNewCohortYear = currentPreEntry?.cohort_year ? currentPreEntry.cohort_year + 1 : new Date().getFullYear();

  return {
    groups,
    oldTerminalGroupName: oldTerminal?.name ?? null,
    newTerminalGroupName: newTerminal?.cohort_year !== undefined && newTerminal?.cohort_year !== null
      ? `${newTerminal.cohort_year} and earlier - Yr 5+`
      : null,
    suggestedNewCohortYear,
  };
}

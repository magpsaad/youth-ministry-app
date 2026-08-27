import { createClient } from "@/lib/supabase/server";

export type TransitionPreviewGroup = {
  id: string;
  name: string;
  cohortYear: number | null;
  ladderPosition: number;
  nextName: string | null; // null = stays as-is (terminal, or no template)
};

export type TransitionPreview = {
  groups: TransitionPreviewGroup[];
  outgoingGroupName: string | null; // the position-4 cohort merging into terminal this time, if any
  suggestedNewCohortYear: number;
};

/** REQUIREMENTS.md §5 -- everything the Group Transition confirmation
 * screen needs to show before the Admin commits: every group's current vs.
 * next-name preview, which cohort (if any) is about to merge into the
 * terminal tier, and a suggested year for the new incoming pre-entry cohort. */
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
    if (g.ladder_position === 4) {
      // Merges into the terminal group -- no longer gets its own "next name".
      return { id: g.id, name: g.name, cohortYear: g.cohort_year, ladderPosition: g.ladder_position, nextName: null };
    }
    if (g.ladder_position >= 5) {
      // Terminal group's name is permanent -- never regenerated.
      return { id: g.id, name: g.name, cohortYear: g.cohort_year, ladderPosition: g.ladder_position, nextName: null };
    }
    const nextName = renderName(g.cohort_year, String(g.ladder_position + 1));
    return { id: g.id, name: g.name, cohortYear: g.cohort_year, ladderPosition: g.ladder_position, nextName };
  });

  const outgoing = rows.find((g) => g.ladder_position === 4);
  const currentPreEntry = rows.find((g) => g.ladder_position === 0);
  const suggestedNewCohortYear = currentPreEntry?.cohort_year ? currentPreEntry.cohort_year + 1 : new Date().getFullYear();

  return {
    groups,
    outgoingGroupName: outgoing?.name ?? null,
    suggestedNewCohortYear,
  };
}

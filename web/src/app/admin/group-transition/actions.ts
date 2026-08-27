"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTransitionPreview, type TransitionPreview } from "@/lib/group-transition";
import { getServantDirectory, type ServantDirectoryEntry } from "@/lib/servant-directory";
import { getAccessibleGroups } from "@/lib/groups";
import type { GroupSummary } from "@/lib/groups";

/** For the post-transition "Review Servant Assignments" step -- fetched
 * fresh (not passed down from the pre-transition page load), since group
 * assignments just changed. */
export async function getPostTransitionReviewDataAction(): Promise<{
  servants: ServantDirectoryEntry[];
  groups: GroupSummary[];
}> {
  const [servants, groups] = await Promise.all([getServantDirectory(), getAccessibleGroups()]);
  return { servants, groups: groups.filter((g) => g.ladder_position > 0) };
}

export async function getTransitionPreviewAction(): Promise<TransitionPreview> {
  return getTransitionPreview();
}

export type RunTransitionResult = {
  error: string | null;
  affectedGroupNames?: string[];
};

/** REQUIREMENTS.md §5 -- the actual transition runs atomically inside
 * run_group_transition() (migration 0028); this action just calls it and
 * reports back which groups' names changed, for the post-transition QR
 * reprint prompt. The RPC itself already writes the GROUP_TRANSITION_RUN
 * audit entry. */
export async function runGroupTransitionAction(newPreEntryCohortYear: number): Promise<RunTransitionResult> {
  const supabase = await createClient();

  const before = await getTransitionPreview();
  const affectedGroupNames = before.groups
    .filter((g) => g.nextName && g.nextName !== g.name)
    .map((g) => g.nextName as string);

  const { error } = await supabase.rpc("run_group_transition", { new_pre_entry_cohort_year: newPreEntryCohortYear });
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin/group-transition");
  return { error: null, affectedGroupNames };
}

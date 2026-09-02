import { getOutreachEntries } from "@/lib/outreach";
import { getGroupMembersLite } from "@/lib/members";
import { getServantsForGroup } from "@/lib/servants";
import { getAppSettings } from "@/lib/app-settings";
import { getCombinedGroups } from "@/lib/groups";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { OutreachInteractive } from "@/components/outreach/OutreachInteractive";
import { ALL_COHORTS_GROUP_ID } from "@/lib/allCohorts";

export default async function OutreachPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  // "Load Youth Data for all cohorts" (REQUIREMENTS.md §6.1 addendum) --
  // no UI/feature changes here (owner: "No change"), except the Servants
  // filter (and the member picker) now cover the whole service, not just
  // one cohort.
  const groupIds = groupId === ALL_COHORTS_GROUP_ID ? (await getCombinedGroups()).map((g) => g.id) : groupId;

  const [entries, members, servants, settings, profile] = await Promise.all([
    getOutreachEntries(groupIds),
    getGroupMembersLite(groupIds),
    getServantsForGroup(groupIds),
    getAppSettings(),
    user
      ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  return (
    <OutreachInteractive
      groupId={groupId}
      entries={entries}
      members={members}
      servants={servants}
      memberLabel={settings.member_label}
      currentUserId={user?.id ?? ""}
      currentUserName={profile?.full_name ?? user?.email ?? "Unknown"}
    />
  );
}

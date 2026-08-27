import { getDashboardStatsData, getUpcomingBirthdays, getUnassignedMembers } from "@/lib/dashboard";
import { getActionsNeeded, getActionsNeededConfig } from "@/lib/actions-needed";
import { getServantsForGroup } from "@/lib/servants";
import { getUniversities } from "@/lib/universities";
import { getAppSettings } from "@/lib/app-settings";
import { getAccessSummary } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { DashboardInteractive } from "@/components/dashboard/DashboardInteractive";

export default async function DashboardPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [statsData, birthdays, unassigned, actionsNeeded, actionsNeededConfig, servants, universities, settings, access, profile] =
    await Promise.all([
      getDashboardStatsData(groupId),
      getUpcomingBirthdays(groupId),
      getUnassignedMembers(groupId),
      getActionsNeeded(groupId),
      getActionsNeededConfig(),
      getServantsForGroup(groupId),
      getUniversities(),
      getAppSettings(),
      user ? getAccessSummary(user.id) : Promise.resolve(null),
      user
        ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then((r) => r.data)
        : Promise.resolve(null),
    ]);

  const memberLabel = settings.member_label;
  const canDelete = access?.isAdmin || access?.isGeneralCoordinator || false;
  const currentUserName = profile?.full_name ?? user?.email ?? "Unknown";

  return (
    <DashboardInteractive
      groupId={groupId}
      statsData={statsData}
      birthdays={birthdays}
      unassigned={unassigned}
      actionsNeeded={actionsNeeded}
      actionsNeededConfig={actionsNeededConfig}
      servants={servants}
      universities={universities}
      memberLabel={memberLabel}
      canDelete={canDelete}
      currentUserId={user?.id ?? ""}
      currentUserName={currentUserName}
    />
  );
}

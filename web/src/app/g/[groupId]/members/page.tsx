import { getGroupMembers } from "@/lib/members";
import { getUniversities } from "@/lib/universities";
import { getServantsForGroup } from "@/lib/servants";
import { getAppSettings, getAttendanceWindowSettings, weekdayName } from "@/lib/app-settings";
import { getAccessSummary } from "@/lib/roles";
import { getCombinedGroups } from "@/lib/groups";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { MemberListInteractive } from "@/components/members/MemberListInteractive";
import { ALL_COHORTS_GROUP_ID } from "@/lib/allCohorts";

export default async function MembersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  const supabase = await createClient();
  const user = await getCurrentUser();

  // "Load Youth Data for all cohorts" (REQUIREMENTS.md §6.1 addendum) --
  // every accessible cohort's members combined into one list, and the
  // Assigned Servant filter (MemberListInteractive already just renders
  // whatever `servants` it's given) now covers every servant in the whole
  // service instead of just this one cohort's.
  const groupIds = groupId === ALL_COHORTS_GROUP_ID ? (await getCombinedGroups()).map((g) => g.id) : groupId;

  const [members, universities, servants, settings, windowSettings, access, profile] = await Promise.all([
    getGroupMembers(groupIds),
    getUniversities(),
    getServantsForGroup(groupIds),
    getAppSettings(),
    getAttendanceWindowSettings(),
    user ? getAccessSummary(user.id) : Promise.resolve(null),
    user
      ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  return (
    <div className="mt-4">
      <MemberListInteractive
        members={members}
        groupId={groupId}
        universities={universities}
        servants={servants}
        memberLabel={settings.member_label}
        canDelete={access?.isAdmin || access?.isGeneralCoordinator || false}
        currentUserId={user?.id ?? ""}
        currentUserName={profile?.full_name ?? user?.email ?? "Unknown"}
        windowWeeks={windowSettings.youth_attendance_window_weeks}
        dayName={weekdayName(windowSettings.service_weekday)}
      />
    </div>
  );
}

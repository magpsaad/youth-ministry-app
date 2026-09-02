import { getAttendanceBundle } from "@/lib/attendance";
import { getAppSettings } from "@/lib/app-settings";
import { getCombinedGroups } from "@/lib/groups";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { AttendanceInteractive } from "@/components/attendance/AttendanceInteractive";
import { ALL_COHORTS_GROUP_ID } from "@/lib/allCohorts";

export default async function AttendancePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = await getCurrentUser();

  // "Load Youth Data for all cohorts" (REQUIREMENTS.md §6.1 addendum) --
  // no UI/feature changes here (owner: "No change"), just every accessible
  // cohort's members/attendance combined into one bundle.
  const groupIds = groupId === ALL_COHORTS_GROUP_ID ? (await getCombinedGroups()).map((g) => g.id) : groupId;

  const [bundle, settings] = await Promise.all([getAttendanceBundle(groupIds), getAppSettings()]);

  return (
    <AttendanceInteractive
      groupId={groupId}
      bundle={bundle}
      memberLabel={settings.member_label}
      currentUserId={user?.id ?? ""}
    />
  );
}

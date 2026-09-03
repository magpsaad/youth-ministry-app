import { getAnalyticsRawData, getServantAssignments } from "@/lib/analytics";
import { getAppSettings, getAttendanceWindowSettings } from "@/lib/app-settings";
import { getCombinedGroups } from "@/lib/groups";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { AnalyticsInteractive } from "@/components/analytics/AnalyticsInteractive";
import { ALL_COHORTS_GROUP_ID } from "@/lib/allCohorts";

export default async function AnalyticsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = await getCurrentUser();
  const combined = groupId === ALL_COHORTS_GROUP_ID;

  // "Load Youth Data for all cohorts" (REQUIREMENTS.md §6.1 addendum) --
  // Data Completeness/Proximity/Average Attendance by Month are all "No
  // change" per the owner, just computed over the combined data; Servant
  // Assignments additionally gets a Cohort column (`combined` prop below).
  const groupIds = combined ? (await getCombinedGroups()).map((g) => g.id) : groupId;

  const [raw, assignments, settings, windowSettings] = await Promise.all([
    getAnalyticsRawData(groupIds),
    getServantAssignments(groupIds),
    getAppSettings(),
    getAttendanceWindowSettings(),
  ]);

  return (
    <AnalyticsInteractive
      raw={raw}
      servants={assignments.servants}
      unassignedCount={assignments.unassignedCount}
      memberLabel={settings.member_label}
      currentUserId={user?.id ?? ""}
      combined={combined}
      serviceWeekday={windowSettings.service_weekday}
      windowWeeks={windowSettings.youth_attendance_window_weeks}
    />
  );
}

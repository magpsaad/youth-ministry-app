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
  //
  // Owner-reported: the combined view is the slowest of these tabs --
  // fetched here once, up front (needed to know which group_ids to query
  // everything else by), and reused below rather than calling
  // getCombinedGroups() a second time inside the Promise.all, which used to
  // duplicate this same round trip for no reason.
  const combinedGroups = groupId === ALL_COHORTS_GROUP_ID ? await getCombinedGroups() : [];
  const groupIds = groupId === ALL_COHORTS_GROUP_ID ? combinedGroups.map((g) => g.id) : groupId;

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

  const canEditAll = access?.isAdmin || access?.isGeneralCoordinator || false;
  // Owner-reported: the Edit button (and photo controls) showed for
  // Read-Only servants too -- clicking Save/Add Photo now correctly gets
  // rejected (migration 0057 + the actions.ts row-count check), but it's a
  // confusing dead end to let someone start editing at all. A person can
  // hold a real role (servant/sub_coordinator) at one cohort and Read-Only
  // at another, so this has to be computed per-cohort, not as one flag --
  // "editable" means holding any NON-read_only role row at that specific
  // group (mirrors has_group_access() exactly, migration 0024/0057).
  const editableGroupIds = (access?.roles ?? [])
    .filter((r) => r.role !== "read_only" && r.group_id)
    .map((r) => r.group_id as string);

  return (
    <div className="mt-4">
      <MemberListInteractive
        members={members}
        groupId={groupId}
        groups={combinedGroups}
        universities={universities}
        servants={servants}
        memberLabel={settings.member_label}
        groupLabel={settings.group_label}
        canDelete={canEditAll}
        canEditAll={canEditAll}
        editableGroupIds={editableGroupIds}
        currentUserId={user?.id ?? ""}
        currentUserName={profile?.full_name ?? user?.email ?? "Unknown"}
        windowWeeks={windowSettings.youth_attendance_window_weeks}
        dayName={weekdayName(windowSettings.service_weekday)}
      />
    </div>
  );
}

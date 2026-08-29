import { getGroupMembers } from "@/lib/members";
import { getUniversities } from "@/lib/universities";
import { getServantsForGroup } from "@/lib/servants";
import { getAppSettings, getAttendanceWindowSettings, weekdayName } from "@/lib/app-settings";
import { getAccessSummary } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { MemberListInteractive } from "@/components/members/MemberListInteractive";

export default async function MembersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  const supabase = await createClient();
  const user = await getCurrentUser();

  const [members, universities, servants, settings, windowSettings, access, profile] = await Promise.all([
    getGroupMembers(groupId),
    getUniversities(),
    getServantsForGroup(groupId),
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

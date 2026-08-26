import { getAttendanceBundle } from "@/lib/attendance";
import { getAppSettings } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { AttendanceInteractive } from "@/components/attendance/AttendanceInteractive";

export default async function AttendancePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = await getCurrentUser();

  const [bundle, settings] = await Promise.all([getAttendanceBundle(groupId), getAppSettings()]);

  return (
    <AttendanceInteractive
      groupId={groupId}
      bundle={bundle}
      memberLabel={settings.member_label}
      currentUserId={user?.id ?? ""}
    />
  );
}

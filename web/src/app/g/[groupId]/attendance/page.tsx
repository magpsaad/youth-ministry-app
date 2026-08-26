import { getAttendanceBundle } from "@/lib/attendance";
import { getAppSettings } from "@/lib/app-settings";
import { createClient } from "@/lib/supabase/server";
import { AttendanceInteractive } from "@/components/attendance/AttendanceInteractive";

export default async function AttendancePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

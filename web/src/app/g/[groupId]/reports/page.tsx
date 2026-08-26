import { getAnalyticsRawData, getServantAssignments } from "@/lib/analytics";
import { getAppSettings } from "@/lib/app-settings";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsInteractive } from "@/components/analytics/AnalyticsInteractive";

export default async function AnalyticsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [raw, assignments, settings] = await Promise.all([
    getAnalyticsRawData(groupId),
    getServantAssignments(groupId),
    getAppSettings(),
  ]);

  return (
    <AnalyticsInteractive
      raw={raw}
      servants={assignments.servants}
      unassignedCount={assignments.unassignedCount}
      memberLabel={settings.member_label}
      currentUserId={user?.id ?? ""}
    />
  );
}

import { getAnalyticsRawData, getServantAssignments } from "@/lib/analytics";
import { getAppSettings } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { AnalyticsInteractive } from "@/components/analytics/AnalyticsInteractive";

export default async function AnalyticsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = await getCurrentUser();

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

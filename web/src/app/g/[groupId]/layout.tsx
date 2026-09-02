import { notFound, redirect } from "next/navigation";
import { getAppSettings } from "@/lib/app-settings";
import { getLastServiceDate } from "@/lib/dashboard";
import { getAccessSummary } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { GroupNavShell } from "@/components/GroupNavShell";
import { MyAssignedProvider } from "@/components/MyAssignedContext";
import { ALL_COHORTS_GROUP_ID } from "@/lib/allCohorts";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isCombined = groupId === ALL_COHORTS_GROUP_ID;

  const [access, settings, lastServiceDate] = await Promise.all([
    getAccessSummary(user.id),
    getAppSettings(),
    getLastServiceDate(),
  ]);

  if (isCombined) {
    // Owner-reported access rule: General Coordinators and Sub-Coordinators
    // only -- deliberately narrower than the rest of this layout, which
    // otherwise defers entirely to RLS/per-page checks.
    if (!access.isCoordinator) {
      return (
        <div className="min-h-full flex items-center justify-center bg-[#f5f5f5] p-4">
          <p className="text-sm text-[#666]">You don&rsquo;t have access to this page.</p>
        </div>
      );
    }

    return (
      <GroupNavShell
        groupId={ALL_COHORTS_GROUP_ID}
        groupName={`All ${settings.group_label}s Combined`}
        appTitleShort={settings.app_title_short}
        memberLabel={settings.member_label}
        logoUrl={settings.logo_url}
        appVersion={settings.app_version}
        lastServiceDate={lastServiceDate}
        combined
      >
        {children}
      </GroupNavShell>
    );
  }

  const { data: group } = await supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle();

  // RLS returns no row at all if this user can't access the group -- treated
  // the same as a bad ID, rather than leaking whether it exists.
  if (!group) notFound();

  return (
    <MyAssignedProvider>
      <GroupNavShell
        groupId={group.id}
        groupName={group.name}
        appTitleShort={settings.app_title_short}
        memberLabel={settings.member_label}
        logoUrl={settings.logo_url}
        appVersion={settings.app_version}
        lastServiceDate={lastServiceDate}
      >
        {children}
      </GroupNavShell>
    </MyAssignedProvider>
  );
}

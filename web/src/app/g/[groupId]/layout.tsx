import { notFound, redirect } from "next/navigation";
import { getAppSettings } from "@/lib/app-settings";
import { getLastServiceDate } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";
import { GroupNavShell } from "@/components/GroupNavShell";
import { MyAssignedProvider } from "@/components/MyAssignedContext";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: group }, settings, lastServiceDate] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle(),
    getAppSettings(),
    getLastServiceDate(),
  ]);

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

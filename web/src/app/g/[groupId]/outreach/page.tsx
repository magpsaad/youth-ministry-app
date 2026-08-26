import { getOutreachEntries } from "@/lib/outreach";
import { getGroupMembersLite } from "@/lib/members";
import { getServantsForGroup } from "@/lib/servants";
import { getAppSettings } from "@/lib/app-settings";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { OutreachInteractive } from "@/components/outreach/OutreachInteractive";

export default async function OutreachPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [entries, members, servants, settings, profile] = await Promise.all([
    getOutreachEntries(groupId),
    getGroupMembersLite(groupId),
    getServantsForGroup(groupId),
    getAppSettings(),
    user
      ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  return (
    <OutreachInteractive
      groupId={groupId}
      entries={entries}
      members={members}
      servants={servants}
      memberLabel={settings.member_label}
      currentUserId={user?.id ?? ""}
      currentUserName={profile?.full_name ?? user?.email ?? "Unknown"}
    />
  );
}

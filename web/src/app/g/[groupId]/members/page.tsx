import { getGroupMembers, type MemberFilters } from "@/lib/members";
import { getUniversities } from "@/lib/universities";
import { getServantsForGroup } from "@/lib/servants";
import { getAppSettings } from "@/lib/app-settings";
import { getAccessSummary } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { MemberFilterForm } from "@/components/members/MemberFilterForm";
import { MemberGrid } from "@/components/members/MemberGrid";

function toArray(param: string | string[] | undefined): string[] {
  if (!param) return [];
  return Array.isArray(param) ? param : [param];
}

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { groupId } = await params;
  const sp = await searchParams;

  const filters: MemberFilters = {
    q: typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined,
    servantIds: toArray(sp.servant),
    universityIds: toArray(sp.university),
    proximities: toArray(sp.proximity),
    excludeVisitors: sp.excludeVisitors === "1",
    hasPhoto: sp.hasPhoto === "1",
    male: sp.male === "1",
    female: sp.female === "1",
  };
  const activeFilterCount =
    filters.servantIds!.length +
    filters.universityIds!.length +
    filters.proximities!.length +
    (filters.excludeVisitors ? 1 : 0) +
    (filters.hasPhoto ? 1 : 0) +
    (filters.male ? 1 : 0) +
    (filters.female ? 1 : 0);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [members, universities, servants, settings, access] = await Promise.all([
    getGroupMembers(groupId, filters),
    getUniversities(),
    getServantsForGroup(groupId),
    getAppSettings(),
    user ? getAccessSummary(user.id) : Promise.resolve(null),
  ]);

  return (
    <div className="mt-4">
      <MemberFilterForm
        basePath={`/g/${groupId}/members`}
        filters={filters}
        activeFilterCount={activeFilterCount}
        universities={universities}
        servants={servants}
        memberLabel={settings.member_label}
      />
      <MemberGrid
        members={members}
        groupId={groupId}
        universities={universities}
        servants={servants}
        memberLabel={settings.member_label}
        canDelete={access?.isAdmin ?? false}
      />
    </div>
  );
}

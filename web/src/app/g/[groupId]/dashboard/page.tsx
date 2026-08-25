import Link from "next/link";
import { getDashboardStats, getUpcomingBirthdays, getUnassignedMembers } from "@/lib/dashboard";
import { getServantsForGroup } from "@/lib/servants";
import { getUniversities } from "@/lib/universities";
import { getAppSettings } from "@/lib/app-settings";
import { getAccessSummary } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { memberPhotoUrl } from "@/lib/storage";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { AssignServantSelect } from "@/components/members/AssignServantSelect";
import { MemberDetailLink } from "@/components/members/MemberDetailLink";
import { OutreachQuickLink } from "@/components/outreach/OutreachQuickLink";
import { PhoneLink } from "@/components/PhoneLink";
import { CakeIcon, UserPlusIcon } from "@/components/icons";

export default async function DashboardPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [stats, birthdays, unassigned, servants, universities, settings, access, profile] = await Promise.all([
    getDashboardStats(groupId),
    getUpcomingBirthdays(groupId),
    getUnassignedMembers(groupId),
    getServantsForGroup(groupId),
    getUniversities(),
    getAppSettings(),
    user ? getAccessSummary(user.id) : Promise.resolve(null),
    user
      ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const memberLabel = settings.member_label;
  const canDelete = access?.isAdmin || access?.isGeneralCoordinator || false;
  const currentUserName = profile?.full_name ?? user?.email ?? "Unknown";

  return (
    <div className="mt-4 space-y-6">
      <section className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label={`Total ${memberLabel}s`} value={stats.totalMembers} />
          <StatCard label="Never Attended" value={stats.neverAttended} />
          <StatCard label="Present Last Service" value={stats.presentLastServiceDate ?? "—"} />
          <StatCard label="Absent Last Service" value={stats.absentLastServiceDate ?? "—"} />
        </div>
        {stats.visitorCount > 0 && (
          <p className="mt-3 text-xs text-[#666]">
            The above counts exclude {stats.visitorCount} visitor{stats.visitorCount === 1 ? "" : "s"}.
          </p>
        )}
      </section>

      <section className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Proximity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Local" value={stats.proximity.Local} small />
          <StatCard label="Regional" value={stats.proximity.Regional} small />
          <StatCard label="Abroad" value={stats.proximity.Abroad} small />
          <StatCard label="Unknown" value={stats.proximity.Unknown} small />
        </div>
        {stats.visitorCount > 0 && (
          <p className="mt-3 text-xs text-[#666]">
            The above counts exclude {stats.visitorCount} visitor{stats.visitorCount === 1 ? "" : "s"}.
          </p>
        )}
      </section>

      {birthdays.length > 0 && (
        <CollapsibleSection
          id={`birthdays-${groupId}`}
          title={
            <span className="flex items-center gap-2">
              <CakeIcon className="h-5 w-5" /> Current Birthdays
            </span>
          }
        >
          <div className="space-y-2">
            {birthdays.map((m) => {
              const photoUrl = memberPhotoUrl(m.photo_path);
              return (
                <div key={m.id} className="rounded-lg bg-[#e2f0d9] p-3 flex items-center gap-3">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt={m.full_name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center">
                      {m.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <MemberDetailLink
                      memberId={m.id}
                      groupId={groupId}
                      universities={universities}
                      servants={servants}
                      memberLabel={memberLabel}
                      canDelete={canDelete}
                      currentUserName={currentUserName}
                      className="font-semibold text-[#1e3a5f] hover:underline text-left truncate block"
                    >
                      {m.full_name}
                    </MemberDetailLink>
                    {m.assigned_servant && (
                      <p className="text-xs text-[#666]">Assigned Servant: {m.assigned_servant.full_name}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-3">
                    <span className="text-[#28a745] font-medium text-sm">
                      {new Date(m.date_of_birth).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <OutreachQuickLink
                      memberId={m.id}
                      memberName={m.full_name}
                      groupId={groupId}
                      currentUserName={currentUserName}
                      className="text-sm font-semibold text-[#1e3a5f] hover:underline"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        id={`unassigned-${groupId}`}
        title={
          <span className="flex items-center gap-2">
            <UserPlusIcon className="h-5 w-5" /> New Registrations (Unassigned)
          </span>
        }
      >
        {unassigned.length === 0 ? (
          <p className="text-sm text-[#666]">Everyone in this group has an assigned servant.</p>
        ) : (
          <div className="space-y-2">
            {unassigned.map((m) => {
              const photoUrl = memberPhotoUrl(m.photo_path);
              return (
                <div key={m.id} className="rounded-lg bg-[#e3f2fd] p-3 flex items-center gap-3">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt={m.full_name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center">
                      {m.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <MemberDetailLink
                      memberId={m.id}
                      groupId={groupId}
                      universities={universities}
                      servants={servants}
                      memberLabel={memberLabel}
                      canDelete={canDelete}
                      currentUserName={currentUserName}
                      className="font-semibold text-[#1e3a5f] hover:underline text-left truncate block"
                    >
                      {m.full_name}
                    </MemberDetailLink>
                    <p className="text-xs text-[#666] truncate">
                      {m.university?.name ?? "—"}
                      {m.program_of_study ? ` · ${m.program_of_study}` : ""}
                    </p>
                    {m.phone && <PhoneLink phone={m.phone} className="text-xs" />}
                  </div>
                  <AssignServantSelect memberId={m.id} groupId={groupId} memberGender={m.gender} servants={servants} />
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection id={`actions-needed-${groupId}`} title={<span>⚠️ Actions Needed</span>}>
        <p className="text-sm text-[#666]">
          Nothing to report yet — this section flags members who&rsquo;ve stopped attending without a
          recent follow-up, which needs attendance and outreach history to evaluate (Phases C and D).
        </p>
      </CollapsibleSection>

      <div className="text-center">
        <Link href={`/g/${groupId}/members`} className="text-sm font-semibold text-[#1e3a5f] hover:underline">
          View all {memberLabel.toLowerCase()}s →
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] border-t-4 border-[#1e3a5f] p-4">
      <h3 className="text-[11px] uppercase tracking-wide text-[#666] font-semibold">{label}</h3>
      <p className={`mt-1 font-bold text-[#1e3a5f] ${small ? "text-xl" : "text-3xl"}`}>{value}</p>
    </div>
  );
}

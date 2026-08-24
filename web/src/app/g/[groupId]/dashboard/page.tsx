import Link from "next/link";
import { getDashboardStats, getUpcomingBirthdays, getUnassignedMembers } from "@/lib/dashboard";
import { getServantsForGroup } from "@/lib/servants";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { AssignServantSelect } from "@/components/members/AssignServantSelect";

export default async function DashboardPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  const [stats, birthdays, unassigned, servants] = await Promise.all([
    getDashboardStats(groupId),
    getUpcomingBirthdays(groupId),
    getUnassignedMembers(groupId),
    getServantsForGroup(groupId),
  ]);

  return (
    <div className="mt-4 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Members" value={stats.totalMembers} />
        <StatCard label="Never Attended" value={stats.neverAttended} />
        <StatCard
          label="Present Last Service"
          value={stats.presentLastServiceDate ?? "—"}
        />
        <StatCard
          label="Absent Last Service"
          value={stats.absentLastServiceDate ?? "—"}
        />
      </div>

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
        <CollapsibleSection id={`birthdays-${groupId}`} title="Current Birthdays">
          <ul className="divide-y divide-[#f0f0f0]">
            {birthdays.map((m) => (
              <li key={m.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-semibold text-[#333]">{m.full_name}</span>
                  <span className="ml-2 text-[#28a745] font-medium">
                    {new Date(m.date_of_birth).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  {m.assigned_servant && (
                    <span className="ml-2 text-[#666]">— {m.assigned_servant.full_name}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      <CollapsibleSection id={`unassigned-${groupId}`} title="New Registrations (Unassigned)">
        {unassigned.length === 0 ? (
          <p className="text-sm text-[#666]">Everyone in this group has an assigned servant.</p>
        ) : (
          <ul className="divide-y divide-[#f0f0f0]">
            {unassigned.map((m) => (
              <li key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-[#333] truncate">{m.full_name}</p>
                  <p className="text-xs text-[#666] truncate">{m.university?.name ?? "—"}</p>
                </div>
                {servants.length > 0 ? (
                  <AssignServantSelect
                    memberId={m.id}
                    groupId={groupId}
                    memberGender={m.gender}
                    servants={servants}
                  />
                ) : (
                  <span className="text-xs text-[#999]">No servants yet</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <CollapsibleSection id={`actions-needed-${groupId}`} title="⚠️ Actions Needed">
        <p className="text-sm text-[#666]">
          Nothing to report yet — this section flags members who&rsquo;ve stopped attending without a
          recent follow-up, which needs attendance and outreach history to evaluate (Phases C and D).
        </p>
      </CollapsibleSection>

      <div className="text-center">
        <Link href={`/g/${groupId}/members`} className="text-sm font-semibold text-[#1e3a5f] hover:underline">
          View all members →
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

"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { University } from "@/lib/universities";
import type { ServantOption } from "@/lib/servants";
import type { BirthdayMember, DashboardStatsData, UnassignedMember } from "@/lib/dashboard";
import { useMyAssigned } from "@/components/MyAssignedContext";
import { memberPhotoUrl } from "@/lib/storage";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { AssignServantSelect } from "@/components/members/AssignServantSelect";
import { MemberDetailLink } from "@/components/members/MemberDetailLink";
import { OutreachQuickLink } from "@/components/outreach/OutreachQuickLink";
import { PhoneLink } from "@/components/PhoneLink";
import { CakeIcon, UserPlusIcon } from "@/components/icons";

export function DashboardInteractive({
  groupId,
  statsData,
  birthdays,
  unassigned,
  servants,
  universities,
  memberLabel,
  canDelete,
  currentUserId,
  currentUserName,
}: {
  groupId: string;
  statsData: DashboardStatsData;
  birthdays: BirthdayMember[];
  unassigned: UnassignedMember[];
  servants: ServantOption[];
  universities: University[];
  memberLabel: string;
  canDelete: boolean;
  currentUserId: string;
  currentUserName: string;
}) {
  const { myAssignedOnly, hydrated } = useMyAssigned();
  const applyFilter = hydrated && myAssignedOnly;

  const stats = useMemo(() => {
    const rows = applyFilter ? statsData.rows.filter((r) => r.assigned_servant_id === currentUserId) : statsData.rows;
    const totalMembers = rows.length;
    const neverAttended = rows.filter((r) => !r.everAttended).length;
    const presentLastServiceDate = statsData.lastServiceDate ? rows.filter((r) => r.presentLastService).length : null;
    const absentLastServiceDate = statsData.lastServiceDate ? totalMembers - (presentLastServiceDate ?? 0) : null;
    const proximity = { Local: 0, Regional: 0, Abroad: 0, Unknown: 0 };
    for (const r of rows) proximity[r.proximity] += 1;
    return { totalMembers, neverAttended, presentLastServiceDate, absentLastServiceDate, proximity };
  }, [statsData, applyFilter, currentUserId]);

  const filteredBirthdays = applyFilter
    ? birthdays.filter((m) => m.assigned_servant_id === currentUserId)
    : birthdays;
  const filteredUnassigned = applyFilter
    ? unassigned.filter(() => false) // unassigned members can never be "mine"
    : unassigned;

  return (
    <div className="mt-4 space-y-6">
      <section className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label={`Total ${memberLabel}s`} value={stats.totalMembers} />
          <StatCard label="Present Last Service" value={stats.presentLastServiceDate ?? "—"} />
          <StatCard label="Absent Last Service" value={stats.absentLastServiceDate ?? "—"} />
          <StatCard label="Never Attended" value={stats.neverAttended} />
        </div>
        {statsData.visitorCount > 0 && (
          <p className="mt-3 text-xs text-[#666]">
            The above counts exclude {statsData.visitorCount} visitor{statsData.visitorCount === 1 ? "" : "s"}.
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
        {statsData.visitorCount > 0 && (
          <p className="mt-3 text-xs text-[#666]">
            The above counts exclude {statsData.visitorCount} visitor{statsData.visitorCount === 1 ? "" : "s"}.
          </p>
        )}
      </section>

      {filteredBirthdays.length > 0 && (
        <CollapsibleSection
          id={`birthdays-${groupId}`}
          title={
            <span className="flex items-center gap-2">
              <CakeIcon className="h-5 w-5" /> Current Birthdays
            </span>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredBirthdays.map((m) => {
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
                    <div className="flex items-center gap-2">
                      <MemberDetailLink
                        memberId={m.id}
                        groupId={groupId}
                        universities={universities}
                        servants={servants}
                        memberLabel={memberLabel}
                        canDelete={canDelete}
                        currentUserName={currentUserName}
                        className="font-semibold text-[#1e3a5f] hover:underline text-left truncate"
                      >
                        {m.full_name}
                      </MemberDetailLink>
                      <span className="text-[#28a745] font-medium text-sm shrink-0">
                        {new Date(m.date_of_birth).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="text-xs text-[#666]">
                      Assigned Servant: {m.assigned_servant?.full_name ?? "No assigned servant"}
                    </p>
                  </div>
                  <OutreachQuickLink
                    memberId={m.id}
                    memberName={m.full_name}
                    groupId={groupId}
                    currentUserName={currentUserName}
                    className="shrink-0 rounded-md bg-[#1e3a5f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#152a45]"
                  />
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
        {filteredUnassigned.length === 0 ? (
          <p className="text-sm text-[#666]">
            {applyFilter
              ? "No unassigned members can be “mine” — turn off My Assigned List to see them."
              : "Everyone in this group has an assigned servant."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredUnassigned.map((m) => {
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

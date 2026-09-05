import { createClient } from "@/lib/supabase/server";
import { getServantsForGroup, type ServantOption } from "@/lib/servants";
import { fetchAllRows } from "@/lib/pagination";

export type MemberAnalyticsRow = {
  id: string;
  assigned_servant_id: string | null;
  is_visitor: boolean;
  join_date: string | null;
  group_id: string;
  proximity: "Local" | "Regional" | "Abroad" | "Unknown";
  hasPhone: boolean;
  hasEmail: boolean;
  hasDob: boolean;
  hasFatherOfConfession: boolean;
  hasPhoto: boolean;
};

export type AttendanceDateRow = { memberId: string; serviceDate: string };

export type AnalyticsRawData = {
  members: MemberAnalyticsRow[];
  attendance: AttendanceDateRow[];
};

/**
 * REQUIREMENTS.md §6.7/§6.2/§8.1 -- raw per-member rows rather than pre-
 * aggregated stats, so the Analytics tab's client-side "My Assigned List"
 * toggle can recompute Data Completeness, Proximity, and Average Attendance
 * by Month from the same fetch instead of round-tripping to the server --
 * same architecture as the Dashboard's stats (lib/dashboard.ts). Proximity
 * added for the Phase H donut chart -- previously only the Dashboard had
 * this data; Analytics didn't carry it at all.
 */
export async function getAnalyticsRawData(groupId: string | string[]): Promise<AnalyticsRawData> {
  const supabase = await createClient();

  let memberQuery = supabase
    .from("members")
    .select(
      "id, assigned_servant_id, is_visitor, join_date, group_id, phone, email, date_of_birth, father_of_confession, photo_path, university:universities(proximity)",
    )
    .eq("status", "active");
  memberQuery = Array.isArray(groupId) ? memberQuery.in("group_id", groupId) : memberQuery.eq("group_id", groupId);
  const { data: memberRows } = await memberQuery;

  const members: MemberAnalyticsRow[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    assigned_servant_id: m.assigned_servant_id,
    is_visitor: m.is_visitor,
    join_date: m.join_date,
    group_id: m.group_id,
    proximity: ((m.university as unknown as { proximity?: string } | null)?.proximity ?? "Unknown") as MemberAnalyticsRow["proximity"],
    hasPhone: !!m.phone,
    hasEmail: !!m.email,
    hasDob: !!m.date_of_birth,
    hasFatherOfConfession: !!m.father_of_confession,
    hasPhoto: !!m.photo_path,
  }));

  let attendance: AttendanceDateRow[] = [];
  if (members.length > 0) {
    // Filtered by group_id(s) via a join, not `.in("member_id", ids)` --
    // see lib/members.ts's getGroupMembers for why (owner-reported: this
    // exact pattern silently broke the "all cohorts combined" view's
    // Average Attendance by Month, ~900 UUIDs in one filter is a request
    // the Supabase API flatly rejects). Paged via fetchAllRows -- a single
    // cohort alone can already exceed one page (lib/pagination.ts).
    const rows = await fetchAllRows((from, to) => {
      let q = supabase
        .from("attendance_records")
        .select("member_id, service_date, member:members!inner(group_id, status)")
        .eq("attendee_type", "member")
        .eq("member.status", "active")
        .range(from, to);
      q = Array.isArray(groupId) ? q.in("member.group_id", groupId) : q.eq("member.group_id", groupId);
      return q;
    });
    attendance = rows.map((r) => ({ memberId: r.member_id, serviceDate: r.service_date }));
  }

  return { members, attendance };
}

export type ServantAssignments = {
  servants: ServantOption[];
  unassignedCount: number;
};

/** REQUIREMENTS.md §6.7 -- every servant (female before male, then
 * alphabetically), with an unassigned-members total row. Deliberately not
 * filtered by "My Assigned List" -- this table's whole point is comparing
 * caseloads *across* servants, which "just mine" doesn't meaningfully apply to. */
export async function getServantAssignments(groupId: string | string[]): Promise<ServantAssignments> {
  const supabase = await createClient();

  const servants = await getServantsForGroup(groupId);

  let query = supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "active").is("assigned_servant_id", null);
  query = Array.isArray(groupId) ? query.in("group_id", groupId) : query.eq("group_id", groupId);
  const { count } = await query;

  return { servants, unassignedCount: count ?? 0 };
}

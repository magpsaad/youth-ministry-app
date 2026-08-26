import { createClient } from "@/lib/supabase/server";
import { getServantsForGroup, type ServantOption } from "@/lib/servants";

export type MemberAnalyticsRow = {
  id: string;
  assigned_servant_id: string | null;
  is_visitor: boolean;
  created_at: string;
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
 * REQUIREMENTS.md §6.7/§6.2 -- raw per-member rows rather than pre-
 * aggregated stats, so the Analytics tab's client-side "My Assigned List"
 * toggle can recompute Data Completeness and Average Attendance by Month
 * from the same fetch instead of round-tripping to the server -- same
 * architecture as the Dashboard's stats (lib/dashboard.ts).
 */
export async function getAnalyticsRawData(groupId: string): Promise<AnalyticsRawData> {
  const supabase = await createClient();

  const { data: memberRows } = await supabase
    .from("members")
    .select("id, assigned_servant_id, is_visitor, created_at, phone, email, date_of_birth, father_of_confession, photo_path")
    .eq("group_id", groupId)
    .eq("status", "active");

  const members: MemberAnalyticsRow[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    assigned_servant_id: m.assigned_servant_id,
    is_visitor: m.is_visitor,
    created_at: m.created_at,
    hasPhone: !!m.phone,
    hasEmail: !!m.email,
    hasDob: !!m.date_of_birth,
    hasFatherOfConfession: !!m.father_of_confession,
    hasPhoto: !!m.photo_path,
  }));

  const ids = members.map((m) => m.id);
  let attendance: AttendanceDateRow[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from("attendance_records")
      .select("member_id, service_date")
      .eq("attendee_type", "member")
      .in("member_id", ids);
    attendance = (data ?? []).map((r) => ({ memberId: r.member_id, serviceDate: r.service_date }));
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
export async function getServantAssignments(groupId: string): Promise<ServantAssignments> {
  const supabase = await createClient();

  const servants = await getServantsForGroup(groupId);

  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("status", "active")
    .is("assigned_servant_id", null);

  return { servants, unassignedCount: count ?? 0 };
}

import { createClient } from "@/lib/supabase/server";
import { getServantsForGroup, type ServantOption } from "@/lib/servants";

export type DataCompleteness = {
  totalMembers: number;
  pctAssignedServant: number;
  pctPhone: number;
  pctEmail: number;
  pctDob: number;
  pctFatherOfConfession: number;
  pctPhoto: number;
};

/** REQUIREMENTS.md §6.7 -- data-completeness stat cards, over active
 * non-visitor members (matching the visitor-exclusion convention used for
 * every other Dashboard/Analytics aggregate). */
export async function getDataCompleteness(groupId: string): Promise<DataCompleteness> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("assigned_servant_id, phone, email, date_of_birth, father_of_confession, photo_path, is_visitor")
    .eq("group_id", groupId)
    .eq("status", "active");

  const rows = (data ?? []).filter((m) => !m.is_visitor);
  const total = rows.length;
  const pct = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

  return {
    totalMembers: total,
    pctAssignedServant: pct(rows.filter((m) => m.assigned_servant_id).length),
    pctPhone: pct(rows.filter((m) => m.phone).length),
    pctEmail: pct(rows.filter((m) => m.email).length),
    pctDob: pct(rows.filter((m) => m.date_of_birth).length),
    pctFatherOfConfession: pct(rows.filter((m) => m.father_of_confession).length),
    pctPhoto: pct(rows.filter((m) => m.photo_path).length),
  };
}

export type ServantAssignments = {
  servants: ServantOption[];
  unassignedCount: number;
};

/** REQUIREMENTS.md §6.7 -- every servant (female before male, then
 * alphabetically), with an unassigned-members total row. */
export async function getServantAssignments(groupId: string): Promise<ServantAssignments> {
  const supabase = await createClient();

  const servants = await getServantsForGroup(groupId);
  const genderRank = (g: string | null) => (g === "Female" ? 0 : g === "Male" ? 1 : 2);
  const sorted = [...servants].sort((a, b) => {
    const gr = genderRank(a.gender) - genderRank(b.gender);
    return gr !== 0 ? gr : a.full_name.localeCompare(b.full_name);
  });

  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("status", "active")
    .is("assigned_servant_id", null);

  return { servants: sorted, unassignedCount: count ?? 0 };
}

export type MonthlyAttendance = { month: string; label: string; avgPercent: number };

/**
 * REQUIREMENTS.md §6.7 -- average attendance by month, using the same
 * corrected rule as everywhere else (present dates / tracked dates *since
 * that member's registration*, §6.4/§7.2), aggregated per calendar month
 * rather than per member.
 */
export async function getAverageAttendanceByMonth(groupId: string): Promise<MonthlyAttendance[]> {
  const supabase = await createClient();

  const { data: memberRows } = await supabase
    .from("members")
    .select("id, created_at")
    .eq("group_id", groupId)
    .eq("status", "active");
  const members = memberRows ?? [];
  if (members.length === 0) return [];
  const ids = members.map((m) => m.id);

  const { data: attendance } = await supabase
    .from("attendance_records")
    .select("member_id, service_date")
    .eq("attendee_type", "member")
    .in("member_id", ids);
  const rows = attendance ?? [];
  if (rows.length === 0) return [];

  const datesByMonth = new Map<string, Set<string>>();
  for (const r of rows) {
    const month = r.service_date.slice(0, 7);
    if (!datesByMonth.has(month)) datesByMonth.set(month, new Set());
    datesByMonth.get(month)!.add(r.service_date);
  }

  const presentSet = new Set(rows.map((r) => `${r.member_id}|${r.service_date}`));

  return Array.from(datesByMonth.keys())
    .sort()
    .map((month) => {
      const dates = Array.from(datesByMonth.get(month)!);
      let presentCount = 0;
      let totalSlots = 0;
      for (const m of members) {
        const since = m.created_at.slice(0, 10);
        for (const d of dates) {
          if (d < since) continue;
          totalSlots += 1;
          if (presentSet.has(`${m.id}|${d}`)) presentCount += 1;
        }
      }
      const avgPercent = totalSlots > 0 ? Math.round((presentCount / totalSlots) * 100) : 0;
      const label = new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      return { month, label, avgPercent };
    });
}

import { createClient } from "@/lib/supabase/server";
import { getAttendanceWindowSettings } from "@/lib/app-settings";

export type MemberListItem = {
  id: string;
  full_name: string;
  phone: string | null;
  photo_path: string | null;
  program_of_study: string | null;
  is_visitor: boolean;
  gender: string | null;
  date_of_birth: string | null;
  assigned_servant_id: string | null;
  join_date: string | null;
  university: { id: string; name: string; proximity: string } | null;
  assigned_servant: { full_name: string } | null;
  avgAttendancePercent: number | null;
};

export type MemberDetail = MemberListItem & {
  email: string | null;
  university_id: string | null;
  date_of_birth: string | null;
  father_of_confession: string | null;
  home_address: string | null;
  registration_comments: string | null;
  servant_comments: string | null;
};

/** Client-side filter shape -- REQUIREMENTS.md §6.4's filter panel now
 * filters live in the browser (item 21/24d) rather than round-tripping to
 * the server per keystroke/checkbox, so this type is consumed by the
 * client component, not applied here. */
export type MemberFilters = {
  q?: string;
  servantIds?: string[]; // may include the literal "unassigned"
  universityIds?: string[];
  excludeVisitors?: boolean;
  hasPhoto?: boolean;
  male?: boolean;
  female?: boolean;
  proximities?: string[]; // Local | Regional | Abroad | Unknown
  myAssignedOnly?: boolean;
};

const LIST_SELECT =
  "id, full_name, phone, photo_path, program_of_study, is_visitor, gender, date_of_birth, assigned_servant_id, join_date, university:universities(id, name, proximity), assigned_servant:profiles(full_name)";

/**
 * Every active member of a group, with a computed average-attendance % per
 * REQUIREMENTS.md §6.4/§7.2's corrected formula: present dates / tracked
 * dates since the member's `join_date` (their earliest attendance record --
 * §3.3, distinct from `created_at`, which is just when the row was
 * inserted and would read wrong for migrated data), capped to a rolling
 * window (`youth_attendance_window_weeks`, admin-configurable). Returns
 * null (not 0%) when there's no tracked date yet to divide by, including
 * when the member has never attended at all (join_date is null).
 */
export async function getGroupMembers(groupId: string): Promise<MemberListItem[]> {
  const supabase = await createClient();
  const [{ data }, windowSettings] = await Promise.all([
    supabase.from("members").select(LIST_SELECT).eq("group_id", groupId).eq("status", "active").order("full_name"),
    getAttendanceWindowSettings(),
  ]);

  const members = (data ?? []) as unknown as MemberListItem[];
  if (members.length === 0) return [];

  const memberIds = members.map((m) => m.id);
  const { data: attendance } = await supabase
    .from("attendance_records")
    .select("member_id, service_date")
    .eq("attendee_type", "member")
    .in("member_id", memberIds);

  const trackedDates = Array.from(new Set((attendance ?? []).map((a) => a.service_date))).sort();
  const presentByMember = new Map<string, Set<string>>();
  for (const a of attendance ?? []) {
    if (!a.member_id) continue;
    if (!presentByMember.has(a.member_id)) presentByMember.set(a.member_id, new Set());
    presentByMember.get(a.member_id)!.add(a.service_date);
  }

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowSettings.youth_attendance_window_weeks * 7);
  const windowStartISO = windowStart.toISOString().slice(0, 10);

  return members.map((m) => {
    if (!m.join_date) return { ...m, avgAttendancePercent: null };

    const since = m.join_date > windowStartISO ? m.join_date : windowStartISO;
    const trackedInWindow = trackedDates.filter((d) => d >= since);
    const presentSet = presentByMember.get(m.id) ?? new Set<string>();
    const presentCount = trackedInWindow.filter((d) => presentSet.has(d)).length;
    const avgAttendancePercent =
      trackedInWindow.length > 0 ? Math.round((presentCount / trackedInWindow.length) * 100) : null;

    return { ...m, avgAttendancePercent };
  });
}

export type MemberBasic = {
  id: string;
  full_name: string;
  phone: string | null;
  assigned_servant_id: string | null;
};

/** Lightweight roster fetch for contexts that just need id/name/phone/
 * assignment (e.g. the Outreach tab's member picker) -- skips the
 * per-member average-attendance computation getGroupMembers does, which
 * requires a second full attendance_records fetch this doesn't need. */
export async function getGroupMembersLite(groupId: string): Promise<MemberBasic[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, full_name, phone, assigned_servant_id")
    .eq("group_id", groupId)
    .eq("status", "active")
    .order("full_name");
  return data ?? [];
}

export async function getMember(memberId: string): Promise<MemberDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select(
      `${LIST_SELECT}, email, university_id, father_of_confession, home_address, registration_comments, servant_comments`,
    )
    .eq("id", memberId)
    .maybeSingle();

  if (!data) return null;
  return { ...(data as unknown as MemberDetail), avgAttendancePercent: null };
}

import { createClient } from "@/lib/supabase/server";
import { getAttendanceWindowSettings, isOnServiceWeekday } from "@/lib/app-settings";
import { fetchAllRows } from "@/lib/pagination";

export type AttendanceMemberBase = {
  id: string;
  full_name: string;
  is_visitor: boolean;
  assigned_servant_id: string | null;
  proximity: "Local" | "Regional" | "Abroad" | "Unknown";
};

export type AttendanceBundle = {
  members: AttendanceMemberBase[];
  /** member id -> every service_date they were present for */
  attendanceByMember: Record<string, string[]>;
  trackedDates: string[]; // descending, most recent first
  todayDate: string;
  todayAvailable: boolean;
};

function nowInTimezone(timezone: string): { date: string; timeMinutes: number } {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [h, m] = timeStr.split(":").map(Number);
  return { date, timeMinutes: h * 60 + m };
}

function toMinutes(hms: string): number {
  const [h, m] = hms.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Everything the Attendance tab needs in one pass: the member roster
 * (with proximity/visitor/assignment flags), every attendance row for
 * those members, and the date-picker's derived options -- fetched once,
 * up front, so switching the selected date is a pure client-side
 * recomputation (REQUIREMENTS.md §6.5) instead of a fresh server round
 * trip per date, and so members/attendance aren't fetched twice over
 * (previously one query each inside getAttendanceDates and again inside
 * getAttendanceForDate).
 *
 * "Today" becomes available once EITHER someone has already checked in
 * today OR the configured same-day cutoff has passed, whichever happens
 * first (§7.2).
 */
export async function getAttendanceBundle(groupId: string | string[]): Promise<AttendanceBundle> {
  const supabase = await createClient();

  let memberQuery = supabase
    .from("members")
    .select("id, full_name, is_visitor, assigned_servant_id, university:universities(proximity)")
    .eq("status", "active")
    .order("full_name");
  memberQuery = Array.isArray(groupId) ? memberQuery.in("group_id", groupId) : memberQuery.eq("group_id", groupId);

  const [{ data: settings }, { data: memberRows }, windowSettings] = await Promise.all([
    supabase.from("app_settings").select("same_day_cutoff_time, timezone").single(),
    memberQuery,
    getAttendanceWindowSettings(),
  ]);

  const cutoff = settings?.same_day_cutoff_time ?? "21:00:00";
  const timezone = settings?.timezone ?? "America/New_York";
  const { date: todayDate, timeMinutes } = nowInTimezone(timezone);

  const members: AttendanceMemberBase[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name,
    is_visitor: m.is_visitor,
    assigned_servant_id: m.assigned_servant_id,
    proximity: ((m.university as unknown as { proximity?: string } | null)?.proximity ??
      "Unknown") as AttendanceMemberBase["proximity"],
  }));

  const attendanceByMember: Record<string, string[]> = {};
  const trackedDatesSet = new Set<string>();

  if (members.length > 0) {
    // Filtered by group_id(s) via a join, not `.in("member_id", ids)` with
    // every id from a potentially large member list -- see lib/members.ts's
    // getGroupMembers for why (owner-reported: this exact pattern silently
    // broke the "all cohorts combined" view's Attendance tab, ~900 UUIDs in
    // one filter is a request the Supabase API flatly rejects). Paged via
    // fetchAllRows -- a single cohort alone can already exceed one page
    // (lib/pagination.ts).
    const attendance = await fetchAllRows((from, to) => {
      let q = supabase
        .from("attendance_records")
        .select("member_id, service_date, member:members!inner(group_id, status)")
        .eq("attendee_type", "member")
        .eq("member.status", "active")
        .range(from, to);
      q = Array.isArray(groupId) ? q.in("member.group_id", groupId) : q.eq("member.group_id", groupId);
      return q;
    });

    for (const row of attendance) {
      (attendanceByMember[row.member_id] ??= []).push(row.service_date);
      trackedDatesSet.add(row.service_date);
    }
  }

  const trackedDates = Array.from(trackedDatesSet).sort((a, b) => (a < b ? 1 : -1));
  const todayHasRows = trackedDatesSet.has(todayDate);
  // Same fix as the servants' equivalent (lib/servant-attendance.ts,
  // owner-reported there) -- this was purely time-of-day before, with no
  // check that today is actually the configured service day.
  const cutoffPassed = isOnServiceWeekday(todayDate, windowSettings.service_weekday) && timeMinutes >= toMinutes(cutoff);

  return { members, attendanceByMember, trackedDates, todayDate, todayAvailable: todayHasRows || cutoffPassed };
}

import { createClient } from "@/lib/supabase/server";

export type AttendanceMember = {
  id: string;
  full_name: string;
  is_visitor: boolean;
  proximity: "Local" | "Regional" | "Abroad" | "Unknown";
  present: boolean;
  everAttended: boolean;
  assigned_servant_id: string | null;
};

export type AttendanceDatesInfo = {
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
 * REQUIREMENTS.md §7.2 -- date-picker options: every date with at least one
 * tracked row for this group, plus "Today" once EITHER someone has already
 * checked in today (typically via the public QR self-check-in) OR the
 * configured same-day cutoff time has passed in the deployment's timezone
 * -- whichever happens first, confirmed.
 */
export async function getAttendanceDates(groupId: string): Promise<AttendanceDatesInfo> {
  const supabase = await createClient();

  const { data: settings } = await supabase.from("app_settings").select("same_day_cutoff_time, timezone").single();
  const cutoff = settings?.same_day_cutoff_time ?? "21:00:00";
  const timezone = settings?.timezone ?? "America/New_York";
  const { date: todayDate, timeMinutes } = nowInTimezone(timezone);

  const { data: memberRows } = await supabase
    .from("members")
    .select("id")
    .eq("group_id", groupId)
    .eq("status", "active");
  const ids = (memberRows ?? []).map((m) => m.id);

  let trackedDates: string[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from("attendance_records")
      .select("service_date")
      .eq("attendee_type", "member")
      .in("member_id", ids);
    trackedDates = Array.from(new Set((data ?? []).map((r) => r.service_date))).sort((a, b) => (a < b ? 1 : -1));
  }

  const todayHasRows = trackedDates.includes(todayDate);
  const cutoffPassed = timeMinutes >= toMinutes(cutoff);

  return { trackedDates, todayDate, todayAvailable: todayHasRows || cutoffPassed };
}

/**
 * Every active member of the group for the given date, with present/never-
 * attended flags for the Present/Absent/"Never Attended" table (§6.5) --
 * both derived from row existence (this date, and ever, respectively), no
 * separate status column needed (confirmed).
 */
export async function getAttendanceForDate(groupId: string, date: string): Promise<AttendanceMember[]> {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, full_name, is_visitor, assigned_servant_id, university:universities(proximity)")
    .eq("group_id", groupId)
    .eq("status", "active")
    .order("full_name");

  const rows = members ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((m) => m.id);

  const { data: attendance } = await supabase
    .from("attendance_records")
    .select("member_id, service_date")
    .eq("attendee_type", "member")
    .in("member_id", ids);

  const presentToday = new Set((attendance ?? []).filter((a) => a.service_date === date).map((a) => a.member_id));
  const everAttendedSet = new Set((attendance ?? []).map((a) => a.member_id));

  return rows.map((m) => ({
    id: m.id,
    full_name: m.full_name,
    is_visitor: m.is_visitor,
    assigned_servant_id: m.assigned_servant_id,
    proximity: ((m.university as unknown as { proximity?: string } | null)?.proximity ??
      "Unknown") as AttendanceMember["proximity"],
    present: presentToday.has(m.id),
    everAttended: everAttendedSet.has(m.id),
  }));
}

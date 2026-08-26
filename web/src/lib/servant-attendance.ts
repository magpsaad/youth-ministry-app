import { createClient } from "@/lib/supabase/server";

export type ServantAttendanceMember = {
  id: string;
  full_name: string;
  groupLabel: string; // serving group name, "General Coordinator", or "Unassigned"
};

export type ServantAttendanceBundle = {
  members: ServantAttendanceMember[];
  attendanceByServant: Record<string, string[]>;
  trackedDates: string[];
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

/** REQUIREMENTS.md §6.13 -- same Present/Absent pattern as member attendance
 * (§6.5), applied to servants. Visible to Coordinator Corner (any
 * coordinator tier, per the widened RLS in migration 0022), not scoped to
 * one group -- every servant across the whole ministry shows on one list. */
export async function getServantAttendanceBundle(): Promise<ServantAttendanceBundle> {
  const supabase = await createClient();

  const [{ data: settings }, { data: roleRows }] = await Promise.all([
    supabase.from("app_settings").select("same_day_cutoff_time, timezone").single(),
    supabase
      .from("user_roles")
      .select("user_id, role, group_id, groups(name), profiles(full_name)")
      .in("role", ["servant", "general_coordinator"]),
  ]);

  const cutoff = settings?.same_day_cutoff_time ?? "21:00:00";
  const timezone = settings?.timezone ?? "America/New_York";
  const { date: todayDate, timeMinutes } = nowInTimezone(timezone);

  const byUser = new Map<string, ServantAttendanceMember>();
  for (const r of roleRows ?? []) {
    if (byUser.has(r.user_id)) continue;
    const profile = r.profiles as unknown as { full_name: string } | null;
    if (!profile) continue;
    const groupName = (r.groups as unknown as { name: string } | null)?.name;
    const groupLabel = r.role === "general_coordinator" ? "General Coordinator" : (groupName ?? "Unassigned");
    byUser.set(r.user_id, { id: r.user_id, full_name: profile.full_name, groupLabel });
  }

  const members = Array.from(byUser.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const ids = members.map((m) => m.id);

  const attendanceByServant: Record<string, string[]> = {};
  const trackedDatesSet = new Set<string>();

  if (ids.length > 0) {
    const { data: attendance } = await supabase
      .from("attendance_records")
      .select("servant_id, service_date")
      .eq("attendee_type", "servant")
      .in("servant_id", ids);

    for (const row of attendance ?? []) {
      (attendanceByServant[row.servant_id] ??= []).push(row.service_date);
      trackedDatesSet.add(row.service_date);
    }
  }

  const trackedDates = Array.from(trackedDatesSet).sort((a, b) => (a < b ? 1 : -1));
  const todayHasRows = trackedDatesSet.has(todayDate);
  const cutoffPassed = timeMinutes >= toMinutes(cutoff);

  return { members, attendanceByServant, trackedDates, todayDate, todayAvailable: todayHasRows || cutoffPassed };
}

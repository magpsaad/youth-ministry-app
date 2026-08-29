import { createClient } from "@/lib/supabase/server";
import { getAttendanceWindowSettings, resolveAttendanceSince, isOnServiceWeekday } from "@/lib/app-settings";

export type ServantDirectoryEntry = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  photo_path: string | null;
  gender: string | null;
  father_of_confession: string | null;
  join_date: string | null;
  isGeneralCoordinator: boolean;
  servantGroups: { id: string; name: string; ladder_position: number }[]; // groups this person holds a 'servant' role for
  isUnassignedServant: boolean; // holds a 'servant' role with no group
  averageAttendance: number | null; // null = never attended, or no tracked dates in the window
};

/**
 * REQUIREMENTS.md §6.13 -- the cross-group servant roster used by Servant
 * Directory and Servant Profiles (Servant Assignments has its own richer
 * roster, lib/servant-assignments.ts, since it needs every role grant, not
 * just 'servant'). Includes anyone holding a 'servant' or
 * 'general_coordinator' role row (Sub-Coordinators/Admins-only-with-no-
 * servant-role aren't "servants" for this listing). Average attendance % is
 * a rolling window (`servant_attendance_window_weeks`, admin-configurable,
 * owner's explicit choice distinct from members' rule in §7.2), floored at
 * the servant's `join_date` (their earliest attendance record -- §3.5), and
 * only counts dates on the configured service weekday (Friday by default).
 */
export async function getServantDirectory(): Promise<ServantDirectoryEntry[]> {
  const supabase = await createClient();
  const windowSettings = await getAttendanceWindowSettings();
  const windowWeeks = windowSettings.servant_attendance_window_weeks;
  let queryFloorISO: string | null = null;
  if (windowWeeks !== null) {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowWeeks * 7);
    queryFloorISO = windowStart.toISOString().slice(0, 10);
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id, role, group_id, groups(name, ladder_position)")
    .in("role", ["servant", "general_coordinator"]);

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, photo_path, gender, father_of_confession, join_date");

  const profilesById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  type Accum = {
    isGeneralCoordinator: boolean;
    servantGroups: { id: string; name: string; ladder_position: number }[];
    isUnassignedServant: boolean;
  };
  const byUser = new Map<string, Accum>();

  for (const r of roleRows ?? []) {
    const acc = byUser.get(r.user_id) ?? {
      isGeneralCoordinator: false,
      servantGroups: [],
      isUnassignedServant: false,
    };
    if (r.role === "general_coordinator") acc.isGeneralCoordinator = true;
    if (r.role === "servant") {
      if (r.group_id) {
        const group = r.groups as unknown as { name: string; ladder_position: number } | null;
        if (group?.name != null) acc.servantGroups.push({ id: r.group_id, name: group.name, ladder_position: group.ladder_position });
      } else {
        acc.isUnassignedServant = true;
      }
    }
    byUser.set(r.user_id, acc);
  }

  const userIds = Array.from(byUser.keys());
  if (userIds.length === 0) return [];

  let attendanceQuery = supabase
    .from("attendance_records")
    .select("servant_id, service_date")
    .eq("attendee_type", "servant")
    .in("servant_id", userIds);
  if (queryFloorISO) attendanceQuery = attendanceQuery.gte("service_date", queryFloorISO);
  const { data: attendanceRows } = await attendanceQuery;

  const presentByServant = new Map<string, Set<string>>();
  const allTrackedDates = new Set<string>();
  for (const row of attendanceRows ?? []) {
    if (!presentByServant.has(row.servant_id)) presentByServant.set(row.servant_id, new Set());
    presentByServant.get(row.servant_id)!.add(row.service_date);
    allTrackedDates.add(row.service_date);
  }
  const trackedDates = Array.from(allTrackedDates).filter((d) => isOnServiceWeekday(d, windowSettings.service_weekday));

  const entries: ServantDirectoryEntry[] = [];
  for (const [userId, acc] of byUser) {
    const profile = profilesById.get(userId);
    if (!profile) continue;

    let averageAttendance: number | null = null;
    const since = resolveAttendanceSince(profile.join_date, windowWeeks);
    if (since) {
      const relevantDates = trackedDates.filter((d) => d >= since);
      const presentSet = presentByServant.get(userId) ?? new Set<string>();
      averageAttendance =
        relevantDates.length > 0
          ? Math.round((relevantDates.filter((d) => presentSet.has(d)).length / relevantDates.length) * 100)
          : null;
    }

    entries.push({
      id: profile.id,
      full_name: profile.full_name,
      phone: profile.phone,
      email: profile.email,
      photo_path: profile.photo_path,
      gender: profile.gender,
      father_of_confession: profile.father_of_confession,
      join_date: profile.join_date,
      isGeneralCoordinator: acc.isGeneralCoordinator,
      servantGroups: acc.servantGroups,
      isUnassignedServant: acc.isUnassignedServant,
      averageAttendance,
    });
  }

  return entries.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

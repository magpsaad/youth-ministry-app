import { createClient } from "@/lib/supabase/server";

export type ServantDirectoryEntry = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  photo_path: string | null;
  gender: string | null;
  father_of_confession: string | null;
  created_at: string;
  isGeneralCoordinator: boolean;
  servantGroups: { id: string; name: string }[]; // groups this person holds a 'servant' role for
  isUnassignedServant: boolean; // holds a 'servant' role with no group
  averageAttendance: number | null; // null = no tracked servant-attendance dates since they joined
};

/**
 * REQUIREMENTS.md §6.13 -- the cross-group servant roster used by Servant
 * Directory, Servant Profiles & Assignments, and Servants Attendance.
 * Includes anyone holding a 'servant' or 'general_coordinator' role row
 * (Sub-Coordinators/Admins-only-with-no-servant-role aren't "servants" for
 * this listing). Average attendance % is a rolling trailing 12 months
 * (owner's explicit choice, distinct from members' all-time-since-
 * registration rule in §7.2) -- tracked servant-attendance dates before a
 * person's own `created_at`, or older than 12 months, are excluded.
 */
export async function getServantDirectory(): Promise<ServantDirectoryEntry[]> {
  const supabase = await createClient();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const twelveMonthsAgoISO = twelveMonthsAgo.toISOString().slice(0, 10);

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id, role, group_id, groups(name)")
    .in("role", ["servant", "general_coordinator"]);

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, photo_path, gender, father_of_confession, created_at");

  const profilesById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  type Accum = {
    isGeneralCoordinator: boolean;
    servantGroups: { id: string; name: string }[];
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
        const groupName = (r.groups as unknown as { name: string } | null)?.name;
        if (groupName) acc.servantGroups.push({ id: r.group_id, name: groupName });
      } else {
        acc.isUnassignedServant = true;
      }
    }
    byUser.set(r.user_id, acc);
  }

  const userIds = Array.from(byUser.keys());
  if (userIds.length === 0) return [];

  const { data: attendanceRows } = await supabase
    .from("attendance_records")
    .select("servant_id, service_date")
    .eq("attendee_type", "servant")
    .in("servant_id", userIds)
    .gte("service_date", twelveMonthsAgoISO);

  const presentByServant = new Map<string, Set<string>>();
  const allTrackedDates = new Set<string>();
  for (const row of attendanceRows ?? []) {
    if (!presentByServant.has(row.servant_id)) presentByServant.set(row.servant_id, new Set());
    presentByServant.get(row.servant_id)!.add(row.service_date);
    allTrackedDates.add(row.service_date);
  }
  const trackedDates = Array.from(allTrackedDates);

  const entries: ServantDirectoryEntry[] = [];
  for (const [userId, acc] of byUser) {
    const profile = profilesById.get(userId);
    if (!profile) continue;

    const since = profile.created_at.slice(0, 10) > twelveMonthsAgoISO ? profile.created_at.slice(0, 10) : twelveMonthsAgoISO;
    const relevantDates = trackedDates.filter((d) => d >= since);
    const presentSet = presentByServant.get(userId) ?? new Set<string>();
    const averageAttendance =
      relevantDates.length > 0
        ? Math.round((relevantDates.filter((d) => presentSet.has(d)).length / relevantDates.length) * 100)
        : null;

    entries.push({
      id: profile.id,
      full_name: profile.full_name,
      phone: profile.phone,
      email: profile.email,
      photo_path: profile.photo_path,
      gender: profile.gender,
      father_of_confession: profile.father_of_confession,
      created_at: profile.created_at,
      isGeneralCoordinator: acc.isGeneralCoordinator,
      servantGroups: acc.servantGroups,
      isUnassignedServant: acc.isUnassignedServant,
      averageAttendance,
    });
  }

  return entries.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

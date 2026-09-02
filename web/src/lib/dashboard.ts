import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/app-settings";
import { fetchAllRows } from "@/lib/pagination";

export type MemberStatRow = {
  id: string;
  assigned_servant_id: string | null;
  everAttended: boolean;
  presentLastService: boolean;
};

export type DashboardStatsData = {
  rows: MemberStatRow[];
  lastServiceDate: string | null;
  visitorCount: number;
};

export type BirthdayMember = {
  id: string;
  full_name: string;
  photo_path: string | null;
  date_of_birth: string;
  phone: string | null;
  assigned_servant_id: string | null;
  assigned_servant: { full_name: string } | null;
};

export type UnassignedMember = {
  id: string;
  full_name: string;
  photo_path: string | null;
  phone: string | null;
  program_of_study: string | null;
  university: { name: string } | null;
  gender: string | null;
};

/** REQUIREMENTS.md §6.3/§7.1 -- members recently assigned a servant who
 * haven't been outreached yet (`is_new_assignment`, cleared automatically
 * once an outreach entry is recorded for them -- migration 0029's trigger --
 * or when a servant dismisses the card). Surfaced under the assigned
 * servant's own list in the Dashboard's Actions Needed section. */
export type NewlyAssignedMember = {
  id: string;
  full_name: string;
  photo_path: string | null;
  phone: string | null;
  program_of_study: string | null;
  university: { name: string } | null;
  gender: string | null;
  assigned_servant_id: string;
  assignedServantName: string;
};

/** Lightweight, used by the nav shell header on every tab (not just Dashboard). */
export async function getLastServiceDate(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("service_date")
    .eq("attendee_type", "member")
    .order("service_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.service_date ?? null;
}

/**
 * REQUIREMENTS.md §6.3/§7.2/§6.2. Returns per-member raw rows rather than
 * pre-aggregated counts, so the Dashboard's client-side "My Assigned List"
 * toggle can recompute Overview from the same fetch instead of round-
 * tripping to the server -- same client-side-filter architecture as the
 * Member List. (Proximity moved to Analytics-only, §8.1 -- no longer
 * computed or joined here.) "Tracked" service dates are whichever dates
 * actually have
 * at least one attendance row -- there are none yet, since the Attendance tab
 * (Phase C) hasn't been built, so `lastServiceDate` correctly comes back null
 * rather than a misleading 0 for present/absent counts.
 */
export async function getDashboardStatsData(groupId: string): Promise<DashboardStatsData> {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, is_visitor, assigned_servant_id")
    .eq("group_id", groupId)
    .eq("status", "active");

  const active = members ?? [];
  const nonVisitors = active.filter((m) => !m.is_visitor);
  const memberIds = nonVisitors.map((m) => m.id);

  let lastServiceDate: string | null = null;
  let everAttendedSet = new Set<string>();
  let presentLastServiceSet = new Set<string>();

  if (memberIds.length > 0) {
    const { data: latestDateRow } = await supabase
      .from("attendance_records")
      .select("service_date")
      .eq("attendee_type", "member")
      .order("service_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestDateRow) {
      lastServiceDate = latestDateRow.service_date;

      // All-time, per-cohort -- can exceed one page on its own (confirmed
      // directly: Yr1 alone already has 1200+ attendance_records), so a
      // plain single request here would silently truncate and mark some
      // members "Never Attended" who actually have (whichever ones happen
      // to fall past row 1000). Paged via fetchAllRows (lib/pagination.ts).
      const attendedIds = await fetchAllRows((from, to) =>
        supabase
          .from("attendance_records")
          .select("member_id")
          .eq("attendee_type", "member")
          .in("member_id", memberIds)
          .range(from, to),
      );
      everAttendedSet = new Set(attendedIds.map((r) => r.member_id));

      const { data: presentRows } = await supabase
        .from("attendance_records")
        .select("member_id")
        .eq("attendee_type", "member")
        .eq("service_date", lastServiceDate)
        .in("member_id", memberIds);
      presentLastServiceSet = new Set((presentRows ?? []).map((r) => r.member_id));
    }
  }

  const rows: MemberStatRow[] = nonVisitors.map((m) => ({
    id: m.id,
    assigned_servant_id: m.assigned_servant_id,
    everAttended: everAttendedSet.has(m.id),
    presentLastService: presentLastServiceSet.has(m.id),
  }));

  return { rows, lastServiceDate, visitorCount: active.length - nonVisitors.length };
}

/** REQUIREMENTS.md §6.3 -- admin-configurable days-before/days-after window
 * (default 7/14), wrapping the year boundary. Date-of-birth is an ISO
 * date-only string ("YYYY-MM-DD"); `new Date(iso)` parses that as UTC
 * midnight, so calling local getters on it shifts the date back a day in
 * any timezone behind UTC -- parse the y/m/d components by hand instead
 * (same fix already applied elsewhere, e.g. AttendanceInteractive's
 * formatDate) rather than going through the UTC-anchored Date. */
export async function getUpcomingBirthdays(groupId: string): Promise<BirthdayMember[]> {
  const supabase = await createClient();
  const [{ data }, settings] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, photo_path, date_of_birth, phone, assigned_servant_id, assigned_servant:profiles(full_name)")
      .eq("group_id", groupId)
      .eq("status", "active")
      .not("date_of_birth", "is", null),
    getAppSettings(),
  ]);

  const daysBefore = settings.birthday_window_days_before;
  const daysAfter = settings.birthday_window_days_after;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfYear = (d: Date) => {
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d.getTime() - start.getTime()) / 86400000);
  };
  const todayDoy = dayOfYear(today);

  return ((data ?? []) as unknown as BirthdayMember[]).filter((m) => {
    const [, month, day] = m.date_of_birth.split("-").map(Number);
    const bdayThisYear = new Date(today.getFullYear(), month - 1, day);
    let diff = dayOfYear(bdayThisYear) - todayDoy;
    // wrap around the year boundary in both directions
    if (diff < -daysBefore) diff += 365;
    if (diff > daysAfter) diff -= 365;
    return diff >= -daysBefore && diff <= daysAfter;
  });
}

/** REQUIREMENTS.md §6.3 -- members with no assigned servant yet. */
export async function getUnassignedMembers(groupId: string): Promise<UnassignedMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, full_name, photo_path, phone, program_of_study, gender, university:universities(name)")
    .eq("group_id", groupId)
    .eq("status", "active")
    .is("assigned_servant_id", null)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as UnassignedMember[];
}

/** REQUIREMENTS.md §6.3/§7.1 -- members with `is_new_assignment = true`,
 * i.e. assigned a servant recently enough that no outreach entry has been
 * recorded for them yet (set by assignServantAction, auto-cleared by
 * migration 0029's trigger the moment an outreach entry lands, or manually
 * dismissed). Grouped by assigned servant on the Dashboard. */
export async function getNewlyAssignedMembers(groupId: string): Promise<NewlyAssignedMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select(
      "id, full_name, photo_path, phone, program_of_study, gender, assigned_servant_id, university:universities(name), assigned_servant:profiles(full_name)",
    )
    .eq("group_id", groupId)
    .eq("status", "active")
    .eq("is_new_assignment", true)
    .not("assigned_servant_id", "is", null)
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as {
    id: string;
    full_name: string;
    photo_path: string | null;
    phone: string | null;
    program_of_study: string | null;
    gender: string | null;
    assigned_servant_id: string;
    university: { name: string } | null;
    assigned_servant: { full_name: string } | null;
  }[]).map((m) => ({
    id: m.id,
    full_name: m.full_name,
    photo_path: m.photo_path,
    phone: m.phone,
    program_of_study: m.program_of_study,
    gender: m.gender,
    university: m.university,
    assigned_servant_id: m.assigned_servant_id,
    assignedServantName: m.assigned_servant?.full_name ?? "Unknown",
  }));
}

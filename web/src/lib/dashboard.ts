import { createClient } from "@/lib/supabase/server";

export type MemberStatRow = {
  id: string;
  assigned_servant_id: string | null;
  proximity: "Local" | "Regional" | "Abroad" | "Unknown";
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
 * toggle can recompute Overview/Proximity from the same fetch instead of
 * round-tripping to the server -- same client-side-filter architecture as
 * the Member List. "Tracked" service dates are whichever dates actually have
 * at least one attendance row -- there are none yet, since the Attendance tab
 * (Phase C) hasn't been built, so `lastServiceDate` correctly comes back null
 * rather than a misleading 0 for present/absent counts.
 */
export async function getDashboardStatsData(groupId: string): Promise<DashboardStatsData> {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, is_visitor, assigned_servant_id, university:universities(proximity)")
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

      const { data: attendedIds } = await supabase
        .from("attendance_records")
        .select("member_id")
        .eq("attendee_type", "member")
        .in("member_id", memberIds);
      everAttendedSet = new Set((attendedIds ?? []).map((r) => r.member_id));

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
    proximity: ((m.university as unknown as { proximity?: string } | null)?.proximity ?? "Unknown") as MemberStatRow["proximity"],
    everAttended: everAttendedSet.has(m.id),
    presentLastService: presentLastServiceSet.has(m.id),
  }));

  return { rows, lastServiceDate, visitorCount: active.length - nonVisitors.length };
}

/** REQUIREMENTS.md §6.3 -- 7 days ago through 14 days ahead, wrapping the year boundary. */
export async function getUpcomingBirthdays(groupId: string): Promise<BirthdayMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, full_name, photo_path, date_of_birth, assigned_servant_id, assigned_servant:profiles(full_name)")
    .eq("group_id", groupId)
    .eq("status", "active")
    .not("date_of_birth", "is", null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfYear = (d: Date) => {
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d.getTime() - start.getTime()) / 86400000);
  };
  const todayDoy = dayOfYear(today);

  return ((data ?? []) as unknown as BirthdayMember[]).filter((m) => {
    const dob = new Date(m.date_of_birth);
    const bdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    let diff = dayOfYear(bdayThisYear) - todayDoy;
    // wrap around the year boundary in both directions
    if (diff < -7) diff += 365;
    if (diff > 14) diff -= 365;
    return diff >= -7 && diff <= 14;
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

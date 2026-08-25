import { createClient } from "@/lib/supabase/server";

export type DashboardStats = {
  totalMembers: number;
  neverAttended: number;
  presentLastServiceDate: number | null; // null = no tracked service date exists yet
  absentLastServiceDate: number | null;
  lastServiceDate: string | null;
  visitorCount: number;
  proximity: { Local: number; Regional: number; Abroad: number; Unknown: number };
};

export type BirthdayMember = {
  id: string;
  full_name: string;
  photo_path: string | null;
  date_of_birth: string;
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
 * REQUIREMENTS.md §6.3/§7.2. "Tracked" service dates are whichever dates
 * actually have at least one attendance row -- there are none yet, since
 * the Attendance tab (Phase C) hasn't been built, so presence/absence here
 * correctly comes back as "no tracked date yet" rather than a misleading 0.
 */
export async function getDashboardStats(groupId: string): Promise<DashboardStats> {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, is_visitor, university:universities(proximity)")
    .eq("group_id", groupId)
    .eq("status", "active");

  const active = members ?? [];
  const nonVisitors = active.filter((m) => !m.is_visitor);

  const proximity = { Local: 0, Regional: 0, Abroad: 0, Unknown: 0 };
  for (const m of nonVisitors) {
    const p = ((m.university as unknown as { proximity?: string } | null)?.proximity ?? "Unknown") as keyof typeof proximity;
    proximity[p] = (proximity[p] ?? 0) + 1;
  }

  const memberIds = nonVisitors.map((m) => m.id);
  let neverAttended = nonVisitors.length;
  let lastServiceDate: string | null = null;
  let presentLastServiceDate: number | null = null;
  let absentLastServiceDate: number | null = null;

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

      const everAttendedSet = new Set((attendedIds ?? []).map((r) => r.member_id));
      neverAttended = memberIds.filter((id) => !everAttendedSet.has(id)).length;

      const { data: presentRows } = await supabase
        .from("attendance_records")
        .select("member_id")
        .eq("attendee_type", "member")
        .eq("service_date", lastServiceDate)
        .in("member_id", memberIds);

      presentLastServiceDate = presentRows?.length ?? 0;
      absentLastServiceDate = memberIds.length - presentLastServiceDate;
    }
  }

  return {
    totalMembers: nonVisitors.length,
    neverAttended,
    presentLastServiceDate,
    absentLastServiceDate,
    lastServiceDate,
    visitorCount: active.length - nonVisitors.length,
    proximity,
  };
}

/** REQUIREMENTS.md §6.3 -- 7 days ago through 14 days ahead, wrapping the year boundary. */
export async function getUpcomingBirthdays(groupId: string): Promise<BirthdayMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, full_name, photo_path, date_of_birth, assigned_servant:profiles(full_name)")
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

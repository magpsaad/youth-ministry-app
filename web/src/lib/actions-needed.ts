import { createClient } from "@/lib/supabase/server";

export type ActionsNeededMember = {
  id: string;
  full_name: string;
  photo_path: string | null;
  phone: string | null;
  assigned_servant_id: string | null;
  assignedServantName: string | null;
  proximity: "Local" | "Regional" | "Abroad" | "Unknown";
  presenceCount: number;
  currentConsecutiveAbsences: number;
  lastOutreachDate: string | null;
};

type ConfigRow = { proximity: string; min_presence_count: number; min_absence_weeks: number; min_outreach_weeks: number };

/** For the Dashboard's "?" help text -- generated from these same live
 * values (REQUIREMENTS.md §6.9), never hardcoded, so an Admin editing a
 * threshold on the config screen immediately updates what's explained here. */
export async function getActionsNeededConfig(): Promise<ConfigRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("actions_needed_config")
    .select("proximity, min_presence_count, min_absence_weeks, min_outreach_weeks")
    .order("proximity");
  return data ?? [];
}

/**
 * REQUIREMENTS.md §7.1 -- for each active, non-visitor member, using the
 * trailing 12 months: presence_count, current_consecutive_absences
 * (walking backward from the most recent tracked date, stopping at their
 * most recent Present), and whether their outreach is stale (never, or
 * older than that proximity's min_outreach_weeks). Flagged iff all three
 * thresholds hold at once, per the member's proximity-based config.
 */
export async function getActionsNeeded(groupId: string): Promise<ActionsNeededMember[]> {
  const supabase = await createClient();

  const [{ data: members }, { data: config }] = await Promise.all([
    supabase
      .from("members")
      .select(
        "id, full_name, photo_path, phone, is_visitor, assigned_servant_id, assigned_servant:profiles(full_name), university:universities(proximity)",
      )
      .eq("group_id", groupId)
      .eq("status", "active"),
    supabase.from("actions_needed_config").select("proximity, min_presence_count, min_absence_weeks, min_outreach_weeks"),
  ]);

  const activeNonVisitors = (members ?? []).filter((m) => !m.is_visitor);
  if (activeNonVisitors.length === 0) return [];

  const configByProximity = new Map((config ?? []).map((c: ConfigRow) => [c.proximity, c]));
  const memberIds = activeNonVisitors.map((m) => m.id);

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoffISO = twelveMonthsAgo.toISOString().slice(0, 10);

  const { data: attendanceRows } = await supabase
    .from("attendance_records")
    .select("member_id, service_date")
    .eq("attendee_type", "member")
    .in("member_id", memberIds)
    .gte("service_date", cutoffISO);

  const presentByMember = new Map<string, Set<string>>();
  const allTrackedDates = new Set<string>();
  for (const row of attendanceRows ?? []) {
    if (!row.member_id) continue;
    if (!presentByMember.has(row.member_id)) presentByMember.set(row.member_id, new Set());
    presentByMember.get(row.member_id)!.add(row.service_date);
    allTrackedDates.add(row.service_date);
  }
  const trackedDatesDesc = Array.from(allTrackedDates).sort((a, b) => (a < b ? 1 : -1));

  const { data: outreachRows } = await supabase
    .from("outreach_entries")
    .select("member_id, occurred_at")
    .in("member_id", memberIds)
    .order("occurred_at", { ascending: false });

  const latestOutreachByMember = new Map<string, string>();
  for (const row of outreachRows ?? []) {
    if (!latestOutreachByMember.has(row.member_id)) latestOutreachByMember.set(row.member_id, row.occurred_at);
  }

  const now = Date.now();
  const results: ActionsNeededMember[] = [];

  for (const m of activeNonVisitors) {
    const proximity = ((m.university as unknown as { proximity?: string } | null)?.proximity ??
      "Unknown") as ActionsNeededMember["proximity"];
    const cfg = configByProximity.get(proximity);
    if (!cfg) continue;

    const memberDates = presentByMember.get(m.id) ?? new Set<string>();
    const presenceCount = memberDates.size;

    let currentConsecutiveAbsences = 0;
    for (const d of trackedDatesDesc) {
      if (memberDates.has(d)) break;
      currentConsecutiveAbsences++;
    }

    const lastOutreach = latestOutreachByMember.get(m.id) ?? null;
    const outreachIsStale =
      !lastOutreach || now - new Date(lastOutreach).getTime() > cfg.min_outreach_weeks * 7 * 86400000;

    if (
      presenceCount >= cfg.min_presence_count &&
      currentConsecutiveAbsences >= cfg.min_absence_weeks &&
      outreachIsStale
    ) {
      results.push({
        id: m.id,
        full_name: m.full_name,
        photo_path: m.photo_path,
        phone: m.phone,
        assigned_servant_id: m.assigned_servant_id,
        assignedServantName: (m.assigned_servant as unknown as { full_name: string } | null)?.full_name ?? null,
        proximity,
        presenceCount,
        currentConsecutiveAbsences,
        lastOutreachDate: lastOutreach,
      });
    }
  }

  return results;
}

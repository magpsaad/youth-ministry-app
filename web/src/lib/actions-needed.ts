import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/pagination";

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
 * REQUIREMENTS.md §7.1 -- for each active, non-visitor member: presence_count
 * (trailing 12 months), current_consecutive_absences (owner-defined formula:
 * floor((today - last_present_date) / 7), all-time, not windowed), and
 * whether their outreach is stale (never, or older than that proximity's
 * min_outreach_weeks). Flagged iff all three thresholds hold at once, per
 * the member's proximity-based config.
 */
export async function getActionsNeeded(groupId: string): Promise<ActionsNeededMember[]> {
  const supabase = await createClient();

  const [{ data: members }, { data: config }] = await Promise.all([
    supabase
      .from("members")
      .select(
        "id, full_name, photo_path, phone, is_visitor, assigned_servant_id, created_at, assigned_servant:profiles(full_name), university:universities(proximity)",
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

  // Same PostgREST db-max-rows cap (1000, lib/pagination.ts) as every other
  // all-rows attendance query in this app -- a single cohort's trailing-
  // 12-months attendance can already exceed it, which would silently drop
  // some members' presence and wrongly flag them as needing action.
  const attendanceRows = await fetchAllRows((from, to) =>
    supabase
      .from("attendance_records")
      .select("member_id, service_date")
      .eq("attendee_type", "member")
      .in("member_id", memberIds)
      .gte("service_date", cutoffISO)
      .range(from, to),
  );

  const presentByMember = new Map<string, Set<string>>();
  for (const row of attendanceRows) {
    if (!row.member_id) continue;
    if (!presentByMember.has(row.member_id)) presentByMember.set(row.member_id, new Set());
    presentByMember.get(row.member_id)!.add(row.service_date);
  }

  // Owner-reported: "weeks absent" should be plain calendar math -- (today -
  // last present date) / 7, rounded down -- not a count of tracked SERVICE
  // OCCURRENCES since their last Present record (what this used to do,
  // walking the tracked dates backward until hitting one they were present
  // for), which diverges badly from real elapsed time whenever tracked
  // dates are sparse or irregular (concrete owner-reported cases: a member
  // 6 real weeks absent showing "46 weeks", another 7 real weeks absent
  // showing "5 weeks"). Needs the member's TRUE all-time last-present date,
  // not scoped to the trailing-12-months window above (that window is a
  // distinct, unrelated threshold -- presenceCount), so this is a separate,
  // unscoped query.
  const allPresentRows = await fetchAllRows((from, to) =>
    supabase
      .from("attendance_records")
      .select("member_id, service_date")
      .eq("attendee_type", "member")
      .in("member_id", memberIds)
      .order("service_date", { ascending: false })
      .range(from, to),
  );
  const lastPresentByMember = new Map<string, string>();
  for (const row of allPresentRows) {
    if (!row.member_id) continue;
    if (!lastPresentByMember.has(row.member_id)) lastPresentByMember.set(row.member_id, row.service_date);
  }

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

    // Reference point for "weeks absent": their true last-present date, or
    // (for someone with NO presence on record at all -- a real, reachable
    // case since Abroad's min_presence_count config is 0) the date they
    // joined, so a never-attended member still gets a meaningful "weeks
    // absent" instead of an arbitrary/undefined one.
    const referenceDate = lastPresentByMember.get(m.id) ?? m.created_at?.slice(0, 10) ?? null;
    const currentConsecutiveAbsences = referenceDate
      ? Math.floor((now - new Date(`${referenceDate}T00:00:00Z`).getTime()) / (7 * 86400000))
      : 0;

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

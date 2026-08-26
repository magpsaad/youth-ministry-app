import { createClient } from "@/lib/supabase/server";

export type OutreachEntry = {
  id: string;
  occurred_at: string;
  type: string | null;
  notes: string | null;
  follow_up_due: string | null;
  servant: { full_name: string } | null;
};

/** All past entries for one member, newest first (REQUIREMENTS.md §6.6's "Prev. Outreach"). */
export async function getMemberOutreach(memberId: string): Promise<OutreachEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("outreach_entries")
    .select("id, occurred_at, type, notes, follow_up_due, servant:profiles(full_name)")
    .eq("member_id", memberId)
    .order("occurred_at", { ascending: false });

  return (data ?? []) as unknown as OutreachEntry[];
}

export type OutreachEntryFull = {
  id: string;
  member_id: string;
  member_name: string;
  member_phone: string | null;
  assigned_servant_id: string | null;
  servant_id: string;
  servant_name: string;
  occurred_at: string;
  type: string | null;
  notes: string | null;
  follow_up_due: string | null;
};

/** Full Outreach tab (§6.6) -- every entry for this group's members, newest
 * first. Search/filter (Member, Servant, Date range, My Assigned List)
 * happens client-side on this fetched set, same architecture as the Member
 * List. Filters by the joined member's group_id directly (one round trip)
 * rather than fetching member ids first and filtering in a second query. */
export async function getOutreachEntries(groupId: string): Promise<OutreachEntryFull[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("outreach_entries")
    .select(
      "id, member_id, servant_id, occurred_at, type, notes, follow_up_due, member:members!inner(full_name, phone, assigned_servant_id, group_id), servant:profiles(full_name)",
    )
    .eq("member.group_id", groupId)
    .order("occurred_at", { ascending: false });

  return ((data ?? []) as unknown as {
    id: string;
    member_id: string;
    servant_id: string;
    occurred_at: string;
    type: string | null;
    notes: string | null;
    follow_up_due: string | null;
    member: { full_name: string; phone: string | null; assigned_servant_id: string | null } | null;
    servant: { full_name: string } | null;
  }[]).map((r) => ({
    id: r.id,
    member_id: r.member_id,
    member_name: r.member?.full_name ?? "Unknown",
    member_phone: r.member?.phone ?? null,
    assigned_servant_id: r.member?.assigned_servant_id ?? null,
    servant_id: r.servant_id,
    servant_name: r.servant?.full_name ?? "Unknown",
    occurred_at: r.occurred_at,
    type: r.type,
    notes: r.notes,
    follow_up_due: r.follow_up_due,
  }));
}

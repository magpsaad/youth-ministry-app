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

"use server";

import { createClient } from "@/lib/supabase/server";

export type AuditReportRow = {
  occurred_at: string;
  user_id: string | null;
  user_name: string | null;
};

/** REQUIREMENTS.md §3.11 -- the cap here is deliberate (owner's explicit
 * choice, not a bug to remove): it keeps the report's data set bounded
 * without needing real pagination, and doubles as a soft prompt to use the
 * Admin-only archive tool (archiveAuditLogAction) once history gets long
 * enough to bump into it. 15,000 rows, most-recent-first, so if it's ever
 * hit, what quietly drops off is the oldest activity, not the newest. */
export async function getAuditReportDataAction(): Promise<AuditReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("occurred_at, user_id, profiles(full_name)")
    .order("occurred_at", { ascending: false })
    .limit(15000);

  return (data ?? []).map((r) => ({
    occurred_at: r.occurred_at,
    user_id: r.user_id,
    user_name: (r.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
  }));
}

export type AuditReportUser = { id: string; full_name: string };

/** Same fix, same reason as getAuditLogUsersAction() (Audit Logs'
 * equivalent) -- migration 0037. */
export async function getAuditReportUsersAction(): Promise<AuditReportUser[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_audit_log_users");
  return ((data as { user_id: string; full_name: string }[] | null) ?? [])
    .map((r) => ({ id: r.user_id, full_name: r.full_name }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

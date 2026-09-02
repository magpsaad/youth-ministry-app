"use server";

import { createClient } from "@/lib/supabase/server";

export type AuditReportRow = {
  occurred_at: string;
  user_id: string | null;
  user_name: string | null;
};

export async function getAuditReportDataAction(): Promise<AuditReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("occurred_at, user_id, profiles(full_name)")
    .order("occurred_at", { ascending: false })
    .limit(5000);

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

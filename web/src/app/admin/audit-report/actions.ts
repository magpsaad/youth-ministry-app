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

export async function getAuditReportUsersAction(): Promise<AuditReportUser[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("audit_log").select("user_id, profiles(full_name)").not("user_id", "is", null);

  const byId = new Map<string, string>();
  for (const r of data ?? []) {
    const name = (r.profiles as unknown as { full_name: string } | null)?.full_name;
    if (r.user_id && name && !byId.has(r.user_id)) byId.set(r.user_id, name);
  }
  return Array.from(byId.entries())
    .map(([id, full_name]) => ({ id, full_name }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

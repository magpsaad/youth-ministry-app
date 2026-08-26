"use server";

import { createClient } from "@/lib/supabase/server";

export type AuditReportRow = {
  action_type: string;
  user_name: string | null;
};

export type AuditReportFilters = { fromDate?: string; toDate?: string };

export async function getAuditReportDataAction(filters: AuditReportFilters): Promise<AuditReportRow[]> {
  const supabase = await createClient();
  let query = supabase.from("audit_log").select("action_type, profiles(full_name)").limit(5000);

  if (filters.fromDate) query = query.gte("occurred_at", filters.fromDate);
  if (filters.toDate) query = query.lte("occurred_at", `${filters.toDate}T23:59:59`);

  const { data } = await query;
  return (data ?? []).map((r) => ({
    action_type: r.action_type,
    user_name: (r.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
  }));
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuditLogRow = {
  id: number;
  occurred_at: string;
  action_type: string;
  user_name: string | null;
  group_name: string | null;
  details: Record<string, unknown> | null;
};

export type AuditLogFilters = {
  actionType?: string;
  fromDate?: string;
  toDate?: string;
};

export async function getAuditLogsAction(filters: AuditLogFilters): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, occurred_at, action_type, details, profiles(full_name), groups(name)")
    .order("occurred_at", { ascending: false })
    .limit(300);

  if (filters.actionType) query = query.eq("action_type", filters.actionType);
  if (filters.fromDate) query = query.gte("occurred_at", filters.fromDate);
  if (filters.toDate) query = query.lte("occurred_at", `${filters.toDate}T23:59:59`);

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id,
    occurred_at: r.occurred_at,
    action_type: r.action_type,
    user_name: (r.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
    group_name: (r.groups as unknown as { name: string } | null)?.name ?? null,
    details: r.details as Record<string, unknown> | null,
  }));
}

export type AuditConfigRow = { action_type: string; enabled: boolean; description: string | null };

export async function getAuditConfigAction(): Promise<AuditConfigRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("audit_config").select("action_type, enabled, description").order("action_type");
  return data ?? [];
}

export async function toggleAuditConfigAction(actionType: string, enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("audit_config").update({ enabled }).eq("action_type", actionType);
  if (error) return { error: error.message };

  revalidatePath("/admin/audit-logs");
  return { error: null };
}

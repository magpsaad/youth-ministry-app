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
  userId?: string;
  fromDate?: string;
  toDate?: string;
};

export async function getAuditLogsAction(filters: AuditLogFilters): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, occurred_at, action_type, user_id, details, profiles(full_name), groups(name)")
    .order("occurred_at", { ascending: false })
    .limit(300);

  if (filters.actionType) query = query.eq("action_type", filters.actionType);
  if (filters.userId) query = query.eq("user_id", filters.userId);
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

export type AuditLogUser = { id: string; full_name: string };

/** Distinct users who've actually generated a log entry -- a shorter, more
 * relevant list than every profile in the system. */
export async function getAuditLogUsersAction(): Promise<AuditLogUser[]> {
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

/** REQUIREMENTS.md §3.11 -- deletes log entries older than the given cutoff.
 * Uses a security-definer RPC (migration 0025) rather than a direct table
 * delete, since audit_log deliberately has no delete RLS policy at all (it's
 * meant to be append-only outside of an explicit, Admin-only archive tool). */
export async function archiveAuditLogAction(olderThanDays: number) {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  const { data, error } = await supabase.rpc("archive_audit_log", { cutoff_date: cutoff.toISOString().slice(0, 10) });
  if (error) return { error: error.message, deleted: 0 };

  revalidatePath("/admin/audit-logs");
  return { error: null, deleted: (data as number) ?? 0 };
}

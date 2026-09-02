"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type AccessProfile = { id: string; full_name: string; email: string | null };

export type AccessRoleRow = {
  id: string;
  user_id: string;
  role: "admin" | "general_coordinator" | "sub_coordinator" | "servant" | "read_only";
  group_id: string | null;
  group_name: string | null;
};

export async function getAllProfilesAction(): Promise<AccessProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
  return data ?? [];
}

export async function getAllRoleRowsAction(): Promise<AccessRoleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_roles").select("id, user_id, role, group_id, groups(name)");
  return (data ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    role: r.role,
    group_id: r.group_id,
    group_name: (r.groups as unknown as { name: string } | null)?.name ?? null,
  }));
}

/** Owner-reported: a person can hold at most one 'servant' grant at a time
 * (ministry policy -- the same rule Servant Assignments' reassign already
 * enforces, migration 0031). Granting "servant" here used to always insert
 * a fresh row, so a person who already had one (most commonly Unassigned,
 * auto-granted the moment their Checkin registration links -- lib/
 * supabase/ensure-profile.ts) ended up with two: the old one untouched,
 * plus this new one alongside it -- both Servant Profiles and Servant
 * Assignments then correctly listed them under both. Reassign the existing
 * row instead of duplicating it, same outcome Servant Assignments' own
 * "move to another cohort" control already produces. */
export async function grantRoleAction(
  userId: string,
  role: AccessRoleRow["role"],
  groupId: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in", id: null };

  if (role === "servant") {
    const { data: existing } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "servant")
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("user_roles").update({ group_id: groupId }).eq("id", existing.id);
      if (error) return { error: error.message, id: null };

      await logAudit(user.id, "ADMIN_ACCESS_MAINTENANCE", { groupId, details: { action: "reassign", userId, role } });
      revalidatePath("/admin/access-maintenance");
      return { error: null, id: existing.id as string };
    }
  }

  const { data, error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role, group_id: groupId })
    .select("id")
    .single();
  if (error) return { error: error.message, id: null };

  await logAudit(user.id, "ADMIN_ACCESS_MAINTENANCE", { groupId, details: { action: "grant", userId, role } });
  revalidatePath("/admin/access-maintenance");
  return { error: null, id: data.id as string };
}

export async function revokeRoleAction(roleRowId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("user_roles").delete().eq("id", roleRowId);
  if (error) return { error: error.message };

  await logAudit(user.id, "ADMIN_ACCESS_MAINTENANCE", { details: { action: "revoke", roleRowId } });
  revalidatePath("/admin/access-maintenance");
  return { error: null };
}

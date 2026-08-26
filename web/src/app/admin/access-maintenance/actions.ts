"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type AccessProfile = { id: string; full_name: string; email: string | null };

export type AccessRoleRow = {
  id: string;
  user_id: string;
  role: "admin" | "general_coordinator" | "sub_coordinator" | "servant";
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

export async function grantRoleAction(
  userId: string,
  role: AccessRoleRow["role"],
  groupId: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role, group_id: groupId });
  if (error) return { error: error.message };

  await logAudit(user.id, "ADMIN_ACCESS_MAINTENANCE", { groupId, details: { action: "grant", userId, role } });
  revalidatePath("/admin/access-maintenance");
  return { error: null };
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

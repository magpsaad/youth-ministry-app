import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "general_coordinator" | "sub_coordinator" | "servant";

export type AccessSummary = {
  roles: { role: Role; group_id: string | null }[];
  isAdmin: boolean;
  isGeneralCoordinator: boolean;
  isSubCoordinator: boolean;
  isServant: boolean;
  /** REQUIREMENTS.md §6.1 -- shows the Coordinator Corner (general or sub). */
  isCoordinator: boolean;
};

/**
 * REQUIREMENTS.md §4 -- a user can hold multiple role rows at once; the
 * landing page and every permission check are driven by the union of them,
 * never a single "the" role.
 */
export async function getAccessSummary(userId: string): Promise<AccessSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role, group_id")
    .eq("user_id", userId);

  const roles = (data ?? []) as AccessSummary["roles"];
  const has = (r: Role) => roles.some((row) => row.role === r);

  return {
    roles,
    isAdmin: has("admin"),
    isGeneralCoordinator: has("general_coordinator"),
    isSubCoordinator: has("sub_coordinator"),
    isServant: has("servant"),
    isCoordinator: has("general_coordinator") || has("sub_coordinator"),
  };
}

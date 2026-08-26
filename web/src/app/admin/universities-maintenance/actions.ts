"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function addUniversityAction(name: string, proximity: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("universities").insert({ name, proximity });
  if (error) return { error: error.message };

  await logAudit(user.id, "ADMIN_UNIVERSITIES_MAINTENANCE", { details: { action: "add", name, proximity } });
  revalidatePath("/admin/universities-maintenance");
  return { error: null };
}

export async function updateUniversityAction(id: string, name: string, proximity: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("universities").update({ name, proximity }).eq("id", id);
  if (error) return { error: error.message };

  await logAudit(user.id, "ADMIN_UNIVERSITIES_MAINTENANCE", { details: { action: "update", id, name, proximity } });
  revalidatePath("/admin/universities-maintenance");
  return { error: null };
}

export async function deleteUniversityAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("universities").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(user.id, "ADMIN_UNIVERSITIES_MAINTENANCE", { details: { action: "delete", id } });
  revalidatePath("/admin/universities-maintenance");
  return { error: null };
}

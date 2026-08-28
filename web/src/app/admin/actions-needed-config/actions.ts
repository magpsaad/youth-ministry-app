"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAttendanceWindowSettings, type AttendanceWindowSettings, type AppSettings } from "@/lib/app-settings";

export type ActionsNeededConfigRow = {
  proximity: "Local" | "Regional" | "Abroad" | "Unknown";
  min_presence_count: number;
  min_absence_weeks: number;
  min_outreach_weeks: number;
};

export async function getActionsNeededConfigAction(): Promise<ActionsNeededConfigRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("actions_needed_config")
    .select("proximity, min_presence_count, min_absence_weeks, min_outreach_weeks")
    .order("proximity");
  return data ?? [];
}

export async function updateActionsNeededConfigAction(row: ActionsNeededConfigRow) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("actions_needed_config")
    .update({
      min_presence_count: row.min_presence_count,
      min_absence_weeks: row.min_absence_weeks,
      min_outreach_weeks: row.min_outreach_weeks,
    })
    .eq("proximity", row.proximity);
  if (error) return { error: error.message };

  revalidatePath("/admin/actions-needed-config");
  return { error: null };
}

export { getAttendanceWindowSettings };

export type AdminGroupRow = {
  id: string;
  name: string;
  cohort_year: number | null;
  ladder_position: number;
  qr_color: string | null;
};

/** REQUIREMENTS.md §6.9 -- every active (non-archived) group, for the App
 * Settings "Group Names" panel. Includes the pre-entry group (ladder
 * position 0) same as the raw table -- the UI itself decides what's
 * editable/deletable there, the RPCs underneath refuse unsafe operations
 * regardless (rename_group/add_group_tier/delete_group_tier, migration 0030). */
export async function getGroupsForAdminAction(): Promise<AdminGroupRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("id, name, cohort_year, ladder_position, qr_color")
    .eq("is_archived", false)
    .order("ladder_position");
  return data ?? [];
}

export async function renameGroupAction(groupId: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_group", { p_group_id: groupId, p_name: name });
  if (error) return { error: error.message };

  revalidatePath("/admin/actions-needed-config");
  revalidatePath("/", "layout");
  return { error: null };
}

export type AddGroupTierInput = { cohortYear: number | null; name: string | null; qrColor: string };

/** Extends the active ladder by one tier, inserted just below the current
 * terminal group (which shifts up to make room -- migration 0030). */
export async function addGroupTierAction(input: AddGroupTierInput) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_group_tier", {
    p_cohort_year: input.cohortYear,
    p_name: input.name,
    p_qr_color: input.qrColor,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/actions-needed-config");
  revalidatePath("/", "layout");
  return { error: null };
}

/** Archives one mid-ladder group and closes the gap (migration 0030). The
 * RPC itself refuses to touch the pre-entry or terminal group, or a group
 * that still has active members/role grants attached. */
export async function deleteGroupTierAction(groupId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_group_tier", { p_group_id: groupId });
  if (error) return { error: error.message };

  revalidatePath("/admin/actions-needed-config");
  revalidatePath("/", "layout");
  return { error: null };
}

export type AppSettingsFormInput = Omit<AppSettings, "app_version">;

/** REQUIREMENTS.md §2/§6.3/§6.14 -- editable form for the app's identity/
 * vocabulary fields (previously only ever set by one-off bootstrap SQL) plus
 * the Current Birthdays date window. RLS restricts writes to Admins
 * regardless of what this screen shows. */
export async function updateAppSettingsAction(input: AppSettingsFormInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").update(input).eq("id", true);
  if (error) return { error: error.message };

  // Branding fields are read on nearly every page (header, nav shell), so
  // revalidate broadly rather than just this one admin route.
  revalidatePath("/", "layout");
  return { error: null };
}

/** REQUIREMENTS.md §7.2/§6.13 -- the two independent, admin-configurable
 * rolling-attendance-window settings, folded into this existing threshold-
 * editing screen rather than a new one. */
export async function updateAttendanceWindowSettingsAction(settings: AttendanceWindowSettings) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      youth_attendance_window_weeks: settings.youth_attendance_window_weeks,
      servant_attendance_window_weeks: settings.servant_attendance_window_weeks,
    })
    .eq("id", true);
  if (error) return { error: error.message };

  revalidatePath("/admin/actions-needed-config");
  return { error: null };
}

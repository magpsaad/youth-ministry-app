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

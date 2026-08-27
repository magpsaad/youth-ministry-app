"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAttendanceWindowSettings, type AttendanceWindowSettings } from "@/lib/app-settings";

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

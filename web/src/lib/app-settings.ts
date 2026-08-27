import { createClient } from "@/lib/supabase/server";

export type AppSettings = {
  app_title_long: string;
  app_title_short: string;
  app_subtitle: string;
  logo_url: string | null;
  theme_color: string;
  group_label: string;
  member_label: string;
  app_version: string;
};

const FALLBACK: AppSettings = {
  app_title_long: "Service Members Ministry",
  app_title_short: "Members Ministry",
  app_subtitle: "Servant Dashboard",
  logo_url: null,
  theme_color: "#1e3a5f",
  group_label: "Group",
  member_label: "Member",
  app_version: "4.0",
};

/**
 * REQUIREMENTS.md §2 -- everything about the app's identity and vocabulary
 * is driven by this one row, never hardcoded. Falls back to sane generic
 * defaults if the row can't be read (e.g. logged out, on the login page).
 */
export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select(
      "app_title_long, app_title_short, app_subtitle, logo_url, theme_color, group_label, member_label, app_version",
    )
    .single();

  return data ?? FALLBACK;
}

export type AttendanceWindowSettings = {
  /** null = no rolling cap -- calculate over the person's entire attendance history since their Join Date. */
  youth_attendance_window_weeks: number | null;
  servant_attendance_window_weeks: number | null;
};

const ATTENDANCE_WINDOW_FALLBACK: AttendanceWindowSettings = {
  youth_attendance_window_weeks: 52,
  servant_attendance_window_weeks: 52,
};

/**
 * REQUIREMENTS.md §7.2/§6.13 -- the two independent, admin-configurable
 * rolling-attendance-window settings (owner's explicit choice: weeks,
 * floored at each person's `join_date`). Kept separate from
 * getAppSettings() -- that one is called on nearly every page for
 * branding, and these two fields are only ever needed by the handful of
 * screens that actually compute average attendance %.
 */
export async function getAttendanceWindowSettings(): Promise<AttendanceWindowSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("youth_attendance_window_weeks, servant_attendance_window_weeks")
    .single();

  return data ?? ATTENDANCE_WINDOW_FALLBACK;
}

/**
 * The shared "since" cutoff for an average-attendance-% calculation: the
 * later of (today - windowWeeks) and the person's own join date, so the
 * window never reaches before they actually joined. A null windowWeeks
 * means no rolling cap at all -- since is just their join date, i.e. their
 * entire attendance history. Returns null if the person has never
 * attended (no join date yet).
 */
export function resolveAttendanceSince(joinDate: string | null, windowWeeks: number | null): string | null {
  if (!joinDate) return null;
  if (windowWeeks === null) return joinDate;

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowWeeks * 7);
  const windowStartISO = windowStart.toISOString().slice(0, 10);
  return joinDate > windowStartISO ? joinDate : windowStartISO;
}

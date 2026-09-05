import { createClient } from "@/lib/supabase/server";
import type { AttendanceWindowSettings } from "@/lib/attendance-window";

// Re-exported for every existing server-side importer -- the actual
// definitions live in attendance-window.ts now (no `@/lib/supabase/server`
// import), so a client component can pull them in directly without
// dragging server-only code into its bundle. See that file's header comment.
export type { AttendanceWindowSettings } from "@/lib/attendance-window";
export { isOnServiceWeekday, weekdayName, resolveAttendanceSince } from "@/lib/attendance-window";

export type AppSettings = {
  app_title_long: string;
  app_title_short: string;
  app_subtitle: string;
  logo_url: string | null;
  theme_color: string;
  group_label: string;
  member_label: string;
  app_version: string;
  /** REQUIREMENTS.md §6.3 -- how many days before/after today a birthday
   * counts as "upcoming" on the Dashboard's Current Birthdays section.
   * Was hardcoded 7/14; now admin-editable on the App Settings screen. */
  birthday_window_days_before: number;
  birthday_window_days_after: number;
  /** ISO weekday (Monday=1..Sunday=7) of the regular service -- Friday (5)
   * by default for this deployment. Drives self-check-in gating (§6.11),
   * the Attendance tab's cutoff rule (§7.2), and which attendance dates
   * count toward average attendance % (§7.2). Now admin-editable here
   * too, alongside every other App Labels & Branding field. */
  service_weekday: number;
  /** "HH:MM:SS" -- same-day cutoff time for the Attendance tab's "Today
   * becomes available" rule (§7.2), paired with `timezone` below. */
  same_day_cutoff_time: string;
  /** IANA timezone the cutoff time (and self-check-in gating) is evaluated in. */
  timezone: string;
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
  birthday_window_days_before: 7,
  birthday_window_days_after: 14,
  service_weekday: 5,
  same_day_cutoff_time: "21:00:00",
  timezone: "America/New_York",
};

/**
 * REQUIREMENTS.md §2 -- everything about the app's identity and vocabulary
 * is driven by this one row, never hardcoded. Falls back to sane generic
 * defaults if the row can't be read (e.g. logged out, on the login page).
 *
 * Owner-requested (Version Control screen, migration 0055): the displayed
 * `app_version` now comes from app_releases -- whichever release has the
 * most recent `released_on` date -- not the app_settings.app_version
 * column directly. That column is left in place purely as a last-resort
 * fallback if app_releases is ever empty (shouldn't happen; it's seeded).
 */
export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const [{ data }, { data: latestRelease }] = await Promise.all([
    supabase
      .from("app_settings")
      .select(
        "app_title_long, app_title_short, app_subtitle, logo_url, theme_color, group_label, member_label, app_version, birthday_window_days_before, birthday_window_days_after, service_weekday, same_day_cutoff_time, timezone",
      )
      .single(),
    supabase.from("app_releases").select("version").order("released_on", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const base = data ?? FALLBACK;
  return { ...base, app_version: latestRelease?.version ?? base.app_version };
}

const ATTENDANCE_WINDOW_FALLBACK: AttendanceWindowSettings = {
  youth_attendance_window_weeks: 52,
  servant_attendance_window_weeks: 52,
  service_weekday: 5,
};

/**
 * REQUIREMENTS.md §7.2/§6.13 -- the two independent, admin-configurable
 * rolling-attendance-window settings (owner's explicit choice: weeks,
 * floored at each person's `join_date`), plus the configured service
 * weekday. Kept separate from getAppSettings() -- that one is called on
 * nearly every page for branding, and these fields are only ever needed by
 * the handful of screens that actually compute average attendance %.
 */
export async function getAttendanceWindowSettings(): Promise<AttendanceWindowSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("youth_attendance_window_weeks, servant_attendance_window_weeks, service_weekday")
    .single();

  return data ?? ATTENDANCE_WINDOW_FALLBACK;
}

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

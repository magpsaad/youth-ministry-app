import type { MetadataRoute } from "next";
import { getAppSettings } from "@/lib/app-settings";

/** PWA "Add to Home Screen" icon (Android Chrome/Chromium) -- owner-
 * requested: use the ministry's own configured logo (app_settings.logo_url)
 * instead of no icon at all (there was no manifest here before this).
 *
 * TEMPORARY testing-phase gate, owner's explicit plan: qa gets the logo
 * first so it can be tried out; once approved, swap the check below to
 * `=== "prod"` instead (kept in sync with layout.tsx's generateMetadata,
 * which needs the identical flip) -- prod keeps the branded icon
 * permanently and qa reverts to none, specifically so the two are visually
 * distinguishable at a glance on a home screen. Deployed to both qa and
 * main either way (same env-gating pattern as the QA banner in
 * layout.tsx), so no branch stays manually out of sync for this.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getAppSettings();
  const useLogo = process.env.NEXT_PUBLIC_APP_ENV === "qa" && !!settings.logo_url;

  return {
    name: settings.app_title_long,
    short_name: settings.app_title_short,
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: settings.theme_color,
    icons: useLogo
      ? [
          { src: settings.logo_url!, sizes: "192x192", type: "image/png" },
          { src: settings.logo_url!, sizes: "512x512", type: "image/png" },
        ]
      : [],
  };
}

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { getAppSettings } from "@/lib/app-settings";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();
  return {
    title: {
      default: settings.app_title_long,
      template: `%s · ${settings.app_title_short}`,
    },
    description: settings.app_subtitle,
    applicationName: settings.app_title_short,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: settings.app_title_short,
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await getAppSettings();
  return {
    themeColor: settings.theme_color,
    width: "device-width",
    initialScale: 1,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* REQUIREMENTS.md §8.1 -- 2.5D buttons' press-down feel on touch (2nd
         * round). The first fix (a no-op touchstart listener, the standard
         * workaround for iOS Safari's :active-doesn't-fire-on-tap quirk)
         * wasn't enough -- owner still saw no movement on a real phone. Not
         * chasing that pseudo-class any further: this delegates real
         * pointerdown/pointerup events to stamp `data-pressed="true"` on
         * whichever button/link was actually touched (see the matching
         * `[data-pressed="true"]` rule in globals.css), which fires
         * identically and reliably on iOS, Android, and desktop alike,
         * since it isn't going through `:active` at all. One listener here
         * covers every current and future button/link app-wide -- no need
         * to touch each of the ~75 buttons individually.
         *
         * Round 3 (owner still saw nothing across multiple mobile browsers,
         * which -- since every iOS browser is WebKit under the hood, Apple
         * mandates it -- points at this being an iPhone, where the visual
         * effect above genuinely may be muted/inconsistent for reasons
         * specific to that engine). Added actual haptic feedback via the
         * Vibration API as a second, independent feedback channel: a short
         * buzz on tap, real physical "tactile feedback" rather than
         * something you have to see. IMPORTANT PLATFORM LIMIT: the
         * Vibration API is supported on Android (Chrome, Firefox, Samsung
         * Internet, Edge) but Apple has never implemented it in WebKit, on
         * *any* iOS browser -- this is an OS-level restriction, not
         * something fixable from here. `navigator.vibrate` is
         * feature-detected, so this is a silent no-op on iOS/desktop and
         * only ever does something on Android.
         * `next/script` (not a raw <script> tag) so it survives client-side
         * route transitions, not just the very first page load. */}
        <Script id="press-feedback" strategy="afterInteractive">
          {`(function () {
            function target(el) { return el && el.closest ? el.closest("button, a[href]") : null; }
            function clearAll() {
              document.querySelectorAll('[data-pressed="true"]').forEach(function (el) {
                el.removeAttribute("data-pressed");
              });
            }
            document.addEventListener("pointerdown", function (e) {
              var t = target(e.target);
              if (t) t.setAttribute("data-pressed", "true");
            }, { passive: true });
            ["pointerup", "pointercancel", "pointerleave"].forEach(function (type) {
              document.addEventListener(type, clearAll, { passive: true });
            });
            document.addEventListener("click", function (e) {
              var t = target(e.target);
              if (t && typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(10);
              }
            });
          })();`}
        </Script>
        {children}
      </body>
    </html>
  );
}

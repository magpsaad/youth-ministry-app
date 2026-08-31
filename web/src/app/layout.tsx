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
        {/* iOS Safari doesn't apply the CSS `:active` pseudo-class on tap at all
         * -- a long-standing WebKit quirk -- unless *some* element on the page
         * has a touch event listener registered. This is the standard no-op
         * fix: it makes iOS treat the page as "touch-interactive" so buttons'
         * `active:` press-down styling (the 2.5D button treatment, §8.1) shows
         * up on a real tap, not just a mouse click. Harmless everywhere else.
         * `next/script` (not a raw <script> tag) so it actually re-runs after
         * client-side route transitions, not just the very first page load. */}
        <Script id="ios-active-fix" strategy="afterInteractive">
          {`document.addEventListener("touchstart", function () {}, { passive: true });`}
        </Script>
        {children}
      </body>
    </html>
  );
}

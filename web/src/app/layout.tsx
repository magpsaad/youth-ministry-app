import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

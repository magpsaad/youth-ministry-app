"use client";

import { useRouter } from "next/navigation";
import { RefreshIcon } from "@/components/icons";

/**
 * Owner-requested: sits below the Home link in every page header. Cheap by
 * design -- clicking it just re-runs the same server-side data fetch that
 * already happens on every normal page load (`router.refresh()`, Next.js's
 * built-in "re-fetch this route's data without a full reload" primitive),
 * the exact same work a manual browser refresh or simply revisiting the
 * page would already trigger. No new class of load on the app: it's an
 * on-demand, per-click action a person has to actually press, not
 * something that polls or runs automatically.
 *
 * Pass `onRefresh` for a screen that already has its own reload callback
 * (e.g. ServiceCalendarModal, which isn't a real route and reloads its
 * data via a prop) instead of the router-based default.
 */
export function RefreshButton({ onRefresh, className }: { onRefresh?: () => void; className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => (onRefresh ? onRefresh() : router.refresh())}
      title="Refresh"
      aria-label="Refresh"
      className={className ?? "inline-flex items-center gap-1 text-white/70 hover:text-white transition-colors"}
    >
      <RefreshIcon className="h-8 w-8" />
      <span className="text-xs font-medium">Refresh</span>
    </button>
  );
}

"use client";

import Link, { useLinkStatus } from "next/link";
import { HomeIcon, SpinnerIcon } from "@/components/icons";

function HomeLinkContent() {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? <SpinnerIcon className="h-8 w-8" /> : <HomeIcon className="h-8 w-8" />}
      <span className="text-xs font-medium">Home</span>
    </>
  );
}

/**
 * Owner-requested: the Home link in every page header. Clicking it can sit
 * for a moment while the landing page is fetched, with nothing on screen
 * changing, so people click it again and again. The icon turns into a
 * spinner the instant the click is registered and stays that way until the
 * navigation lands. Same size as the icon, so nothing shifts.
 */
export function HomeLink() {
  return (
    <Link
      href="/"
      title="Home"
      aria-label="Home"
      className="inline-flex items-center gap-1 text-white/70 hover:text-white transition-colors"
    >
      <HomeLinkContent />
    </Link>
  );
}

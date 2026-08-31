"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLogo } from "@/components/AppLogo";
import { HomeIcon } from "@/components/icons";
import { useMyAssigned } from "@/components/MyAssignedContext";
import { SignOutButton } from "@/components/SignOutButton";

const TABS = (memberLabel: string) => [
  { slug: "dashboard", label: "Dashboard" },
  { slug: "members", label: `${memberLabel} List` },
  { slug: "attendance", label: "Attendance" },
  { slug: "outreach", label: "Outreach" },
  { slug: "reports", label: "Analytics" },
];

export function GroupNavShell({
  groupId,
  groupName,
  appTitleShort,
  memberLabel,
  logoUrl,
  appVersion,
  lastServiceDate,
  children,
}: {
  groupId: string;
  groupName: string;
  appTitleShort: string;
  memberLabel: string;
  logoUrl: string | null;
  appVersion: string;
  lastServiceDate: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { myAssignedOnly, toggle, hydrated } = useMyAssigned();
  const filtered = hydrated && myAssignedOnly;

  return (
    <div className="min-h-full flex flex-col bg-[#f5f5f5]">
      <header
        className={`text-white px-5 py-5 text-center shadow-[0_2px_10px_rgba(0,0,0,0.1)] relative transition-colors ${
          filtered
            ? "bg-gradient-to-br from-[#c2185b] to-[#d81b60]"
            : "bg-gradient-to-br from-[#1e3a5f] to-[#2d5a7b]"
        }`}
      >
        <Link href="/" className="inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
          <AppLogo logoUrl={logoUrl} title={appTitleShort} size={32} circular={false} />
          <h1 className="text-2xl font-bold">{appTitleShort}</h1>
        </Link>
        <p className="mt-1 text-sm opacity-90">{groupName}</p>

        <div className="absolute top-2.5 right-4 flex flex-col items-end gap-1">
          <SignOutButton className="text-white/70 hover:text-white transition-colors" />
          <span className="text-[10px] text-white/60">Version {appVersion}</span>
        </div>

        <Link
          href="/"
          title="Home"
          aria-label="Home"
          className="absolute top-2.5 left-4 inline-flex items-center gap-1 text-white/70 hover:text-white transition-colors"
        >
          <HomeIcon className="h-4 w-4" />
          <span className="text-xs font-medium">Home</span>
        </Link>
      </header>

      <nav className="flex bg-white border-b-2 border-[#ddd] overflow-x-auto">
        {TABS(memberLabel).map((tab) => {
          const href = `/g/${groupId}/${tab.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={tab.slug}
              href={href}
              className={`flex-1 min-w-[100px] text-center px-2.5 py-3.5 text-sm font-medium border-b-[3px] transition-colors whitespace-nowrap ${
                active
                  ? "text-[#1e3a5f] border-[#1e3a5f]"
                  : "text-[#666] border-transparent hover:bg-[#f9f9f9]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="max-w-5xl w-full mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-[#333]">
          <input type="checkbox" checked={filtered} onChange={toggle} className="accent-[#1e3a5f]" />
          My Assigned List
        </label>
        <span className="text-sm text-[#666]">
          Last Service Date:{" "}
          {lastServiceDate
            ? new Date(lastServiceDate + "T00:00:00").toLocaleDateString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
              })
            : "N/A"}
        </span>
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 pb-8">{children}</main>
    </div>
  );
}

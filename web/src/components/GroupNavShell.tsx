"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/login/actions";

const TABS = (memberLabel: string) => [
  { slug: "dashboard", label: "Dashboard" },
  { slug: "members", label: `${memberLabel} List` },
  { slug: "attendance", label: "Attendance" },
  { slug: "outreach", label: "Outreach" },
  { slug: "reports", label: "Analytics" },
];

const STORAGE_KEY = "myAssignedOnly";

export function GroupNavShell({
  groupId,
  groupName,
  appTitleShort,
  memberLabel,
  children,
}: {
  groupId: string;
  groupName: string;
  appTitleShort: string;
  memberLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [myAssignedOnly, setMyAssignedOnly] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // REQUIREMENTS.md §6.2 -- persists for the browser session, resets on a
  // new session (sessionStorage, not localStorage).
  useEffect(() => {
    setMyAssignedOnly(sessionStorage.getItem(STORAGE_KEY) === "true");
    setHydrated(true);
  }, []);

  function toggle() {
    const next = !myAssignedOnly;
    setMyAssignedOnly(next);
    sessionStorage.setItem(STORAGE_KEY, String(next));
  }

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
        <Link href="/" className="inline-block">
          <h1 className="text-2xl font-bold hover:opacity-90 transition-opacity">
            {appTitleShort}
          </h1>
        </Link>
        <p className="mt-1 text-sm opacity-90">{groupName} Servant Dashboard</p>
        <form action={signOut} className="absolute top-2.5 right-4">
          <button className="text-[11px] text-white/70 hover:text-white transition-colors">
            Sign out
          </button>
        </form>
        <Link
          href="/"
          className="absolute top-2.5 left-4 text-[11px] text-white/70 hover:text-white transition-colors"
        >
          ← Home
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

      <div className="max-w-5xl w-full mx-auto px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm text-[#333]">
          <input type="checkbox" checked={filtered} onChange={toggle} className="accent-[#1e3a5f]" />
          My Assigned List
        </label>
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 pb-8">{children}</main>
    </div>
  );
}

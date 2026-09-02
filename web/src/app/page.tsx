import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSettings } from "@/lib/app-settings";
import { getAccessibleGroups } from "@/lib/groups";
import { getAccessSummary } from "@/lib/roles";
import { getPendingServantsCount } from "@/lib/pending-servants";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { logAudit } from "@/lib/audit";
import { getRandomVerseAction } from "@/app/actions";
import { LoadGroupPanel } from "@/components/LoadGroupPanel";
import { LoadAllCohortsButton } from "@/components/LoadAllCohortsButton";
import { AppLogo } from "@/components/AppLogo";
import { SignOutButton } from "@/components/SignOutButton";
import { ServiceCalendarButton } from "@/components/calendar/ServiceCalendarButton";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await ensureProfile(user);
  void logAudit(user.id, "APP_ACCESS");

  const [settings, access, groups, pendingServantsCount, verse] = await Promise.all([
    getAppSettings(),
    getAccessSummary(user.id),
    getAccessibleGroups(),
    getPendingServantsCount(),
    getRandomVerseAction(),
  ]);

  // The hidden position-0 pre-entry group is Admin-only everywhere in the
  // app (REQUIREMENTS.md §2.2) -- excluded from the ordinary group selector,
  // but surfaced as its own dedicated, full-width button in the Admin Corner
  // instead (below).
  const selectableGroups = groups.filter((g) => g.ladder_position > 0);
  const yr0Group = groups.find((g) => g.ladder_position === 0);

  return (
    <div className="min-h-full flex flex-col bg-[#f5f5f5]">
      <header className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a7b] text-white px-5 py-6 text-center shadow-[0_2px_10px_rgba(0,0,0,0.1)] relative">
        <div className="flex justify-center">
          <AppLogo logoUrl={settings.logo_url} title={settings.app_title_short} size={60} />
        </div>
        <h1 className="mt-3 text-[28px] font-bold">{settings.app_title_long}</h1>
        <p className="mt-1 text-[13px] opacity-90">{settings.app_subtitle}</p>

        <div className="absolute top-2.5 right-4 flex flex-col items-end gap-1">
          <SignOutButton className="text-white/70 hover:text-white transition-colors" />
          <span className="text-[10px] text-white/60">Version {settings.app_version}</span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Servant Corner -- always visible */}
        <section className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
          <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Servant Corner</h2>
          <LoadGroupPanel
            groups={selectableGroups}
            groupLabel={settings.group_label}
            memberLabel={settings.member_label}
          />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link
              href="/servants-directory"
              className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
            >
              Servant Directory
            </Link>
            <ServiceCalendarButton />
            <Link
              href="/qr-codes"
              className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
            >
              QR Codes
            </Link>
          </div>
        </section>

        {/* Bible verse -- a fixed, always-visible fixture on the landing
            page (REQUIREMENTS.md §6.1). No longer tied to "Load [Member]
            Data" -- it used to display while that data loaded, back when
            the old app's load time was slow enough to need something to
            read; the new app is fast enough that the deliberate pause was
            just adding delay for no benefit, so it's a permanent landing-
            page fixture instead, picked once per page load. */}
        {verse && (
          <div className="rounded-md border-l-4 border-[#ffc107] bg-[#fff3cd] px-4 py-3 text-sm text-[#856404]">
            <p className="italic">&ldquo;{verse.text}&rdquo;</p>
            {verse.reference && <p className="mt-1 font-semibold">— {verse.reference}</p>}
          </div>
        )}

        {/* Coordinator Corner -- General or Sub-Coordinators (and Admins) */}
        {(access.isCoordinator || access.isAdmin) && (
          <section className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Coordinator Corner</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {access.isCoordinator && (
                <div className="sm:col-span-2">
                  <LoadAllCohortsButton memberLabel={settings.member_label} groupLabel={settings.group_label} />
                </div>
              )}
              <Link
                href="/servant-profiles"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Servant Profiles
              </Link>
              <Link
                href="/servant-assignments"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Servant Assignments
              </Link>
              <Link
                href="/servants-attendance"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Servants Attendance
              </Link>
              {(access.isAdmin || access.isGeneralCoordinator) && (
                <Link
                  href="/admin/pending-servants"
                  className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] flex items-center justify-center gap-2 shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                >
                  Pending Servants
                  {pendingServantsCount > 0 && (
                    <span className="rounded-full bg-[#dc3545] text-white text-[11px] px-2 py-0.5">
                      {pendingServantsCount}
                    </span>
                  )}
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Admin Corner -- Admins only */}
        {access.isAdmin && (
          <section className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Admin Corner</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {yr0Group && (
                <Link
                  href={`/g/${yr0Group.id}/members`}
                  className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] sm:col-span-2 shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                >
                  View: {yr0Group.name}
                </Link>
              )}
              <Link
                href="/admin/access-maintenance"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Access Maintenance
              </Link>
              <Link
                href="/admin/universities-maintenance"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Universities Maintenance
              </Link>
              <Link
                href="/admin/calendar-maintenance"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Calendar Maintenance
              </Link>
              <Link
                href="/admin/verses-maintenance"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Verses Maintenance
              </Link>
              <Link
                href="/admin/actions-needed-config"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                App Settings
              </Link>
              <Link
                href="/admin/group-transition"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Group Transition
              </Link>
              <Link
                href="/admin/audit-logs"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Audit Logs
              </Link>
              <Link
                href="/admin/audit-report"
                className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Audit Report
              </Link>
            </div>
          </section>
        )}

        {/* The proxy gate (src/lib/supabase/proxy.ts) already redirects
            anyone with no role at all to /register before they ever reach
            this page -- this is just a defensive fallback in case that
            somehow didn't fire. */}
        {!access.isAdmin && !access.isCoordinator && !access.isServant && !access.isReadOnly && (
          <p className="text-center text-sm text-[#666]">
            Your account isn&rsquo;t assigned to any role yet.{" "}
            <Link href="/register" className="underline">
              Register here
            </Link>
            , or contact an Admin for access.
          </p>
        )}
      </main>
    </div>
  );
}

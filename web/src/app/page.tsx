import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSettings } from "@/lib/app-settings";
import { getAccessibleGroups } from "@/lib/groups";
import { getAccessSummary } from "@/lib/roles";
import { getPendingServantsCount } from "@/lib/pending-servants";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { LoadGroupPanel } from "@/components/LoadGroupPanel";
import { AppLogo } from "@/components/AppLogo";
import { SignOutButton } from "@/components/SignOutButton";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await ensureProfile(user);

  const [settings, access, groups, pendingServantsCount] = await Promise.all([
    getAppSettings(),
    getAccessSummary(user.id),
    getAccessibleGroups(),
    getPendingServantsCount(),
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
        <section className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
          <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Servant Corner</h2>
          <LoadGroupPanel
            groups={selectableGroups}
            groupLabel={settings.group_label}
            memberLabel={settings.member_label}
          />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <StubButton label="Servants Directory" />
            <StubButton label="Service Calendar" />
            <StubButton label="QR Codes" />
          </div>
        </section>

        {/* Coordinator Corner -- General or Sub-Coordinators (and Admins) */}
        {(access.isCoordinator || access.isAdmin) && (
          <section className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Coordinator Corner</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <StubButton label="Servant Profiles &amp; Assignments" />
              <StubButton label="Servants Attendance" />
              {(access.isAdmin || access.isGeneralCoordinator) && (
                <Link
                  href="/admin/pending-servants"
                  className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#152a45] sm:col-span-2 flex items-center justify-center gap-2"
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
          <section className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Admin Corner</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {yr0Group && <StubButton label={`Load: ${yr0Group.name}`} fullWidth />}
              <StubButton label="Access Maintenance" />
              <StubButton label="Universities Maintenance" />
              <StubButton label="Calendar Maintenance" />
              <StubButton label="Actions Needed Config" />
              <StubButton label="Verses Maintenance" />
              <StubButton label="Group Transition" />
              <StubButton label="Audit Logs" />
              <StubButton label="Audit Report" />
            </div>
          </section>
        )}

        {!access.isAdmin && !access.isCoordinator && !access.isServant && (
          <p className="text-center text-sm text-[#666]">
            Your account isn&rsquo;t assigned to any role yet. Contact an Admin for access.
          </p>
        )}
      </main>
    </div>
  );
}

function StubButton({ label, fullWidth }: { label: string; fullWidth?: boolean }) {
  return (
    <button
      disabled
      title="Coming in a later phase"
      className={`rounded-md bg-[#f0f0f0] px-4 py-3 text-sm font-semibold text-[#999] cursor-not-allowed ${
        fullWidth ? "sm:col-span-2" : ""
      }`}
    >
      {label}
    </button>
  );
}

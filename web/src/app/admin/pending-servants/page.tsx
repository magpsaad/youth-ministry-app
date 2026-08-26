import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessSummary } from "@/lib/roles";
import { getAppSettings } from "@/lib/app-settings";
import { getPendingServants } from "@/lib/pending-servants";
import { AppLogo } from "@/components/AppLogo";
import { HomeIcon } from "@/components/icons";
import { PendingServantRow } from "@/components/admin/PendingServantRow";

/** Minimal Admin/General Coordinator screen to review servants who self-
 * registered via the "Servants" QR code (0014_servant_self_registration.sql)
 * -- a functional first pass, to be folded into the fuller Admin screens
 * design in Phase F. */
export default async function PendingServantsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccessSummary(user.id);
  if (!access.isAdmin && !access.isGeneralCoordinator) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#f5f5f5] p-4">
        <p className="text-sm text-[#666]">You don&rsquo;t have access to this page.</p>
      </div>
    );
  }

  const [pending, settings] = await Promise.all([getPendingServants(), getAppSettings()]);

  return (
    <div className="min-h-full bg-[#f5f5f5]">
      <header className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a7b] text-white px-5 py-6 text-center shadow-[0_2px_10px_rgba(0,0,0,0.1)] relative">
        <Link
          href="/"
          title="Home"
          aria-label="Home"
          className="absolute top-2.5 left-4 text-white/70 hover:text-white transition-colors"
        >
          <HomeIcon className="h-4 w-4" />
        </Link>
        <div className="flex justify-center">
          <AppLogo logoUrl={settings.logo_url} title={settings.app_title_short} size={48} />
        </div>
        <h1 className="mt-2 text-lg font-bold">Pending Servants</h1>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {pending.length === 0 ? (
          <p className="text-sm text-[#666] text-center">No pending servant registrations right now.</p>
        ) : (
          pending.map((s) => <PendingServantRow key={s.id} servant={s} />)
        )}
      </main>
    </div>
  );
}

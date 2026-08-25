import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessSummary } from "@/lib/roles";
import { getPendingServants } from "@/lib/pending-servants";
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

  const pending = await getPendingServants();

  return (
    <div className="min-h-full bg-[#f5f5f5]">
      <header className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a7b] text-white px-5 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">Pending Servants</h1>
          <Link href="/" className="text-sm text-white/80 hover:text-white hover:underline">
            ← Back to Home
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {pending.length === 0 ? (
          <p className="text-sm text-[#666]">No pending servant registrations right now.</p>
        ) : (
          pending.map((s) => <PendingServantRow key={s.id} servant={s} />)
        )}
      </main>
    </div>
  );
}

import { cookies } from "next/headers";
import Link from "next/link";
import { getCheckInFlow, listCheckInMembers, listCheckInServants } from "@/lib/checkin";
import { getUniversities } from "@/lib/universities";
import { getAppSettings } from "@/lib/app-settings";
import { weekdayName } from "@/lib/attendance-window";
import { SERVANT_CHECKIN_COOKIE, MEMBER_CHECKIN_COOKIE, parseRememberedCheckinPerson } from "@/lib/checkin-remember-cookie";
import { AppLogo } from "@/components/AppLogo";
import { HomeIcon } from "@/components/icons";
import { SignOutButton } from "@/components/SignOutButton";
import { CheckInFlow } from "@/components/checkin/CheckInFlow";

/** REQUIREMENTS.md §6.11/§6.12 -- public, no-login check-in/intake page.
 * One route serves every group's QR code and the "Servants" QR alike; the
 * token alone (via checkin_get_flow) decides which flow to render. */
export default async function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [flow, settings] = await Promise.all([getCheckInFlow(token), getAppSettings()]);

  if (!flow) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#f5f5f5] p-4">
        <div className="max-w-sm w-full text-center bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-6">
          <h1 className="text-lg font-bold text-[#dc3545]">Invalid Check-In Code</h1>
          <p className="mt-2 text-sm text-[#666]">This QR code isn&rsquo;t recognized. Please ask a servant for help.</p>
        </div>
      </div>
    );
  }

  const [people, universities] = await Promise.all([
    flow.isServant ? listCheckInServants(token) : flow.flowType === "check_in_and_intake" ? listCheckInMembers(token) : Promise.resolve([]),
    flow.isServant ? Promise.resolve([]) : getUniversities(),
  ]);

  const rememberCookieName = flow.isServant ? SERVANT_CHECKIN_COOKIE : MEMBER_CHECKIN_COOKIE;
  const rememberedPersonId =
    flow.flowType === "check_in_and_intake"
      ? (parseRememberedCheckinPerson((await cookies()).get(rememberCookieName)?.value)?.id ?? null)
      : null;

  return (
    <div className="min-h-full bg-[#f5f5f5]">
      <header className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a7b] text-white px-5 py-6 text-center shadow-[0_2px_10px_rgba(0,0,0,0.1)] relative">
        {/* Owner-requested: servants (unlike anonymous youth self-check-in)
            are logged-in app users, so give them a way back into the main
            app and a quick sign-out right from the check-in screen --
            member self-check-in stays exactly as before. */}
        {flow.isServant && (
          <>
            <Link
              href="/"
              title="Home"
              aria-label="Home"
              className="absolute top-2.5 left-4 inline-flex items-center gap-1 text-white/70 hover:text-white transition-colors"
            >
              <HomeIcon className="h-4 w-4" />
              <span className="text-xs font-medium">Home</span>
            </Link>
            <SignOutButton className="absolute top-2.5 right-4 text-white/70 hover:text-white transition-colors" />
          </>
        )}
        <div className="flex justify-center">
          <AppLogo logoUrl={settings.logo_url} title={settings.app_title_short} size={56} />
        </div>
        <h1 className="mt-3 text-xl font-bold">{settings.app_title_short}</h1>
        <p className="mt-1 text-sm opacity-90">{flow.label}</p>
      </header>
      <main className="max-w-md mx-auto px-4 py-6">
        <CheckInFlow
          token={token}
          isServant={flow.isServant}
          flowType={flow.flowType}
          initialPeople={people}
          universities={universities}
          memberLabel={settings.member_label}
          serviceDayName={weekdayName(settings.service_weekday)}
          rememberedPersonId={rememberedPersonId}
        />
      </main>
    </div>
  );
}

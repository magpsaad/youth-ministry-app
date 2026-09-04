import { cookies } from "next/headers";
import { getCheckInFlow, listCheckInMembers, listCheckInServants } from "@/lib/checkin";
import { getUniversities } from "@/lib/universities";
import { getAppSettings } from "@/lib/app-settings";
import { weekdayName } from "@/lib/attendance-window";
import { SERVANT_CHECKIN_COOKIE, parseRememberedServant } from "@/lib/servant-checkin-cookie";
import { AppLogo } from "@/components/AppLogo";
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

  const rememberedServantId = flow.isServant
    ? (parseRememberedServant((await cookies()).get(SERVANT_CHECKIN_COOKIE)?.value)?.id ?? null)
    : null;

  return (
    <div className="min-h-full bg-[#f5f5f5]">
      <header className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a7b] text-white px-5 py-6 text-center shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
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
          rememberedPersonId={rememberedServantId}
        />
      </main>
    </div>
  );
}

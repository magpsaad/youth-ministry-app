import { getAttendanceDates, getAttendanceForDate } from "@/lib/attendance";
import { getAppSettings } from "@/lib/app-settings";
import { AttendanceInteractive } from "@/components/attendance/AttendanceInteractive";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function AttendancePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  const [datesInfo, settings] = await Promise.all([getAttendanceDates(groupId), getAppSettings()]);

  const dateOptions = datesInfo.trackedDates.map((d) => ({
    value: d,
    label: d === datesInfo.todayDate ? `${formatDate(d)} (Today)` : formatDate(d),
  }));
  if (datesInfo.todayAvailable && !datesInfo.trackedDates.includes(datesInfo.todayDate)) {
    dateOptions.unshift({ value: datesInfo.todayDate, label: `${formatDate(datesInfo.todayDate)} (Today)` });
  }

  if (dateOptions.length === 0) {
    return (
      <div className="mt-4 rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-6 text-center text-sm text-[#666]">
        No service dates are tracked yet for this group, and today isn&rsquo;t open for attendance until the
        configured cutoff time (or until someone checks in via the QR code).
      </div>
    );
  }

  const defaultDate = dateOptions[0].value;
  const members = await getAttendanceForDate(groupId, defaultDate);

  return (
    <AttendanceInteractive
      groupId={groupId}
      dateOptions={dateOptions}
      initialDate={defaultDate}
      initialMembers={members}
      memberLabel={settings.member_label}
    />
  );
}

import { getDataCompleteness, getServantAssignments, getAverageAttendanceByMonth } from "@/lib/analytics";
import { getAppSettings } from "@/lib/app-settings";

export default async function AnalyticsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  const [completeness, assignments, monthly, settings] = await Promise.all([
    getDataCompleteness(groupId),
    getServantAssignments(groupId),
    getAverageAttendanceByMonth(groupId),
    getAppSettings(),
  ]);

  const memberLabel = settings.member_label;
  const maxAvg = Math.max(1, ...monthly.map((m) => m.avgPercent));

  return (
    <div className="mt-4 space-y-6">
      <section className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Data Completeness</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Assigned to Servants" value={completeness.pctAssignedServant} />
          <StatCard label="Has Phone" value={completeness.pctPhone} />
          <StatCard label="Has Email" value={completeness.pctEmail} />
          <StatCard label="Has DOB" value={completeness.pctDob} />
          <StatCard label="Has Father of Confession" value={completeness.pctFatherOfConfession} />
          <StatCard label="Has Photo" value={completeness.pctPhoto} />
        </div>
        <p className="mt-3 text-xs text-[#666]">
          Based on {completeness.totalMembers} active {memberLabel.toLowerCase()}
          {completeness.totalMembers === 1 ? "" : "s"} (visitors excluded).
        </p>
      </section>

      <section className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Servant Assignments</h2>
        <div className="overflow-hidden rounded-lg border border-[#f0f0f0]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f5f5f5] text-left text-[#666]">
                <th className="px-4 py-2 font-semibold">Servant</th>
                <th className="px-4 py-2 font-semibold">Gender</th>
                <th className="px-4 py-2 text-right font-semibold">Assigned {memberLabel}s</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {assignments.servants.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-medium text-[#333]">{s.full_name}</td>
                  <td className="px-4 py-2.5 text-[#666]">{s.gender ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right text-[#333]">{s.caseload}</td>
                </tr>
              ))}
              <tr className="bg-[#f9f9f9]">
                <td className="px-4 py-2.5 font-semibold text-[#333]" colSpan={2}>
                  Unassigned
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-[#333]">{assignments.unassignedCount}</td>
              </tr>
              {assignments.servants.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[#666]">
                    No servants assigned to this group yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">Average Attendance by Month</h2>
        {monthly.length === 0 ? (
          <p className="text-sm text-[#666]">No tracked service dates yet.</p>
        ) : (
          <div className="space-y-2">
            {monthly.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm text-[#333]">{m.label}</span>
                <div className="flex-1 h-4 rounded-full bg-[#f0f0f0] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1e3a5f]"
                    style={{ width: `${(m.avgPercent / maxAvg) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold text-[#1e3a5f]">
                  {m.avgPercent}%
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] border-t-4 border-[#1e3a5f] p-4">
      <h3 className="text-[11px] uppercase tracking-wide text-[#666] font-semibold">{label}</h3>
      <p className="mt-1 text-3xl font-bold text-[#1e3a5f]">{value}%</p>
    </div>
  );
}

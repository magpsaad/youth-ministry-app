"use client";

import { useState, useTransition } from "react";
import type { ActionsNeededConfigRow } from "@/app/admin/actions-needed-config/actions";
import { updateActionsNeededConfigAction, updateAttendanceWindowSettingsAction } from "@/app/admin/actions-needed-config/actions";
import type { AttendanceWindowSettings } from "@/lib/app-settings";

export function ActionsNeededConfigInteractive({
  initial,
  initialWindowSettings,
}: {
  initial: ActionsNeededConfigRow[];
  initialWindowSettings: AttendanceWindowSettings;
}) {
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [savedProximity, setSavedProximity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [windowSettings, setWindowSettings] = useState(initialWindowSettings);
  const [windowSaved, setWindowSaved] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);

  function handleSaveWindows() {
    setWindowError(null);
    setWindowSaved(false);
    startTransition(async () => {
      const res = await updateAttendanceWindowSettingsAction(windowSettings);
      if (res.error) {
        setWindowError(res.error);
        return;
      }
      setWindowSaved(true);
    });
  }

  function updateField(proximity: string, field: keyof ActionsNeededConfigRow, value: number) {
    setRows((prev) => prev.map((r) => (r.proximity === proximity ? { ...r, [field]: value } : r)));
  }

  function handleSave(row: ActionsNeededConfigRow) {
    setError(null);
    setSavedProximity(null);
    startTransition(async () => {
      const res = await updateActionsNeededConfigAction(row);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSavedProximity(row.proximity);
    });
  }

  return (
    <div className="space-y-4">
    <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
      <h2 className="text-lg font-bold text-[#1e3a5f] mb-1">Attendance Window Settings</h2>
      <p className="text-sm text-[#666] mb-4">
        How far back average-attendance % looks, as a rolling number of weeks -- floored at each person&rsquo;s Join
        Date (their earliest attendance record), so the window never reaches before they actually joined. Youths and
        servants are configured independently.
      </p>
      {windowError && <p className="mb-3 text-sm text-[#dc3545]">{windowError}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="text-xs text-[#666]">
          Youth attendance window (weeks)
          <input
            type="number"
            min={1}
            value={windowSettings.youth_attendance_window_weeks}
            onChange={(e) =>
              setWindowSettings((prev) => ({ ...prev, youth_attendance_window_weeks: Number(e.target.value) }))
            }
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
        <label className="text-xs text-[#666]">
          Servant attendance window (weeks)
          <input
            type="number"
            min={1}
            value={windowSettings.servant_attendance_window_weeks}
            onChange={(e) =>
              setWindowSettings((prev) => ({ ...prev, servant_attendance_window_weeks: Number(e.target.value) }))
            }
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSaveWindows}
          disabled={pending}
          className="rounded-md bg-[#1e3a5f] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
        >
          Save
        </button>
        {windowSaved && <span className="text-xs text-[#155724]">Saved.</span>}
      </div>
    </div>

    <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
      <h2 className="text-lg font-bold text-[#1e3a5f] mb-1">Actions Needed Thresholds</h2>
      <p className="text-sm text-[#666] mb-4">
        Per-proximity thresholds for the Dashboard&rsquo;s Actions Needed algorithm (REQUIREMENTS.md §7.1): a member
        would be flagged once they meet the minimum presence count, minimum consecutive absences, AND their most
        recent outreach is older than the outreach-staleness window, all at once. (The Dashboard section that
        applies these is still a placeholder -- these thresholds are ready for whenever that&rsquo;s built.)
      </p>
      {error && <p className="mb-3 text-sm text-[#dc3545]">{error}</p>}

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.proximity} className="border border-[#f0f0f0] rounded-lg p-4">
            <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">{row.proximity}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <label className="text-xs text-[#666]">
                Min. presence count
                <input
                  type="number"
                  min={0}
                  value={row.min_presence_count}
                  onChange={(e) => updateField(row.proximity, "min_presence_count", Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
                />
              </label>
              <label className="text-xs text-[#666]">
                Min. consecutive absences (weeks)
                <input
                  type="number"
                  min={0}
                  value={row.min_absence_weeks}
                  onChange={(e) => updateField(row.proximity, "min_absence_weeks", Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
                />
              </label>
              <label className="text-xs text-[#666]">
                Outreach staleness (weeks)
                <input
                  type="number"
                  min={0}
                  value={row.min_outreach_weeks}
                  onChange={(e) => updateField(row.proximity, "min_outreach_weeks", Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
                />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSave(row)}
                disabled={pending}
                className="rounded-md bg-[#1e3a5f] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
              >
                Save
              </button>
              {savedProximity === row.proximity && <span className="text-xs text-[#155724]">Saved.</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

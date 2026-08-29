"use client";

import { useState, useTransition } from "react";
import type { ActionsNeededConfigRow, AppSettingsFormInput, AdminGroupRow } from "@/app/admin/actions-needed-config/actions";
import {
  updateActionsNeededConfigAction,
  updateAttendanceWindowSettingsAction,
  updateAppSettingsAction,
} from "@/app/admin/actions-needed-config/actions";
import type { AttendanceWindowSettings } from "@/lib/app-settings";
import { GroupNamesInteractive } from "@/components/admin/GroupNamesInteractive";

// ISO weekday numbering (Monday=1..Sunday=7), matching app_settings.service_weekday.
const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ActionsNeededConfigInteractive({
  initial,
  initialWindowSettings,
  initialAppSettings,
  initialGroups,
}: {
  initial: ActionsNeededConfigRow[];
  initialWindowSettings: AttendanceWindowSettings;
  initialAppSettings: AppSettingsFormInput;
  initialGroups: AdminGroupRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [savedProximity, setSavedProximity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [windowSettings, setWindowSettings] = useState(initialWindowSettings);
  const [windowSaved, setWindowSaved] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);

  const [appSettings, setAppSettings] = useState<AppSettingsFormInput>(initialAppSettings);
  const [appSettingsSaved, setAppSettingsSaved] = useState(false);
  const [appSettingsError, setAppSettingsError] = useState<string | null>(null);

  function updateAppField<K extends keyof AppSettingsFormInput>(field: K, value: AppSettingsFormInput[K]) {
    setAppSettings((prev) => ({ ...prev, [field]: value }));
  }

  function handleSaveAppSettings() {
    setAppSettingsError(null);
    setAppSettingsSaved(false);
    startTransition(async () => {
      const res = await updateAppSettingsAction(appSettings);
      if (res.error) {
        setAppSettingsError(res.error);
        return;
      }
      setAppSettingsSaved(true);
    });
  }

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
      <h2 className="text-lg font-bold text-[#1e3a5f] mb-1">App Labels &amp; Branding</h2>
      <p className="text-sm text-[#666] mb-4">
        The app&rsquo;s identity and vocabulary, used everywhere it&rsquo;s displayed &mdash; e.g. Group Label
        &ldquo;Youth&rdquo;, Ministry Label &ldquo;St Arsanius Youth Ministry&rdquo;.
      </p>
      {appSettingsError && <p className="mb-3 text-sm text-[#dc3545]">{appSettingsError}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="text-xs text-[#666]">
          Ministry Label (long title)
          <input
            value={appSettings.app_title_long}
            onChange={(e) => updateAppField("app_title_long", e.target.value)}
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
        <label className="text-xs text-[#666]">
          Ministry Label (short title)
          <input
            value={appSettings.app_title_short}
            onChange={(e) => updateAppField("app_title_short", e.target.value)}
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
        <label className="text-xs text-[#666]">
          Dashboard Subtitle
          <input
            value={appSettings.app_subtitle}
            onChange={(e) => updateAppField("app_subtitle", e.target.value)}
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
        <label className="text-xs text-[#666]">
          Group Label (e.g. &ldquo;Cohort&rdquo;)
          <input
            value={appSettings.group_label}
            onChange={(e) => updateAppField("group_label", e.target.value)}
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
        <label className="text-xs text-[#666]">
          Member Label (e.g. &ldquo;Youth&rdquo;)
          <input
            value={appSettings.member_label}
            onChange={(e) => updateAppField("member_label", e.target.value)}
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
        <label className="text-xs text-[#666]">
          Service Day
          <select
            value={appSettings.service_weekday}
            onChange={(e) => updateAppField("service_weekday", Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          >
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[#666]">
          Same-Day Cutoff Time
          <input
            type="time"
            value={appSettings.same_day_cutoff_time.slice(0, 5)}
            onChange={(e) => updateAppField("same_day_cutoff_time", e.target.value)}
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
        <label className="text-xs text-[#666]">
          Timezone (IANA name)
          <input
            value={appSettings.timezone}
            onChange={(e) => updateAppField("timezone", e.target.value)}
            placeholder="America/New_York"
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
        <label className="text-xs text-[#666] sm:col-span-2">
          Logo URL (blank = no logo)
          <input
            value={appSettings.logo_url ?? ""}
            onChange={(e) => updateAppField("logo_url", e.target.value === "" ? null : e.target.value)}
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
      </div>
      <p className="text-xs text-[#666] mb-3">
        Service Day drives self-check-in gating and which dates count toward average attendance %. The Cutoff Time
        and Timezone together control when &ldquo;Today&rdquo; becomes available in the Attendance tab — it opens as
        soon as either someone has checked in, or the cutoff time passes, whichever comes first. All three take
        effect immediately, everywhere.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSaveAppSettings}
          disabled={pending}
          className="rounded-md bg-[#1e3a5f] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
        >
          Save
        </button>
        {appSettingsSaved && <span className="text-xs text-[#155724]">Saved.</span>}
      </div>
    </div>

    <GroupNamesInteractive initial={initialGroups} />

    <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
      <h2 className="text-lg font-bold text-[#1e3a5f] mb-1">Current Birthdays Window</h2>
      <p className="text-sm text-[#666] mb-4">
        How many days before and after today a birthday counts as &ldquo;upcoming&rdquo; on the Dashboard.
      </p>
      {appSettingsError && <p className="mb-3 text-sm text-[#dc3545]">{appSettingsError}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="text-xs text-[#666]">
          Days before today
          <input
            type="number"
            min={0}
            value={appSettings.birthday_window_days_before}
            onChange={(e) => updateAppField("birthday_window_days_before", Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
        <label className="text-xs text-[#666]">
          Days after today
          <input
            type="number"
            min={0}
            value={appSettings.birthday_window_days_after}
            onChange={(e) => updateAppField("birthday_window_days_after", Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSaveAppSettings}
          disabled={pending}
          className="rounded-md bg-[#1e3a5f] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
        >
          Save
        </button>
        {appSettingsSaved && <span className="text-xs text-[#155724]">Saved.</span>}
      </div>
    </div>

    <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
      <h2 className="text-lg font-bold text-[#1e3a5f] mb-1">Attendance Window Settings</h2>
      <p className="text-sm text-[#666] mb-1">How far back average-attendance % looks, as a rolling number of weeks.</p>
      <ul className="text-sm text-[#666] mb-4 list-disc pl-5 space-y-0.5">
        <li>
          The app calculates it based on the <strong>later</strong> of (today &minus; the rolling window) and each
          person&rsquo;s Join Date (their earliest attendance record) &mdash; so the window never reaches before they
          joined.
        </li>
        <li>Leave a field blank to calculate over that group&rsquo;s entire attendance history instead, with no rolling cap.</li>
        <li>Youths and servants are configured independently.</li>
      </ul>
      {windowError && <p className="mb-3 text-sm text-[#dc3545]">{windowError}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="text-xs text-[#666]">
          Youth attendance window (weeks, blank = no cap)
          <input
            type="number"
            min={1}
            value={windowSettings.youth_attendance_window_weeks ?? ""}
            onChange={(e) =>
              setWindowSettings((prev) => ({
                ...prev,
                youth_attendance_window_weeks: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            className="mt-1 w-full rounded-md border border-[#ddd] px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
        </label>
        <label className="text-xs text-[#666]">
          Servant attendance window (weeks, blank = no cap)
          <input
            type="number"
            min={1}
            value={windowSettings.servant_attendance_window_weeks ?? ""}
            onChange={(e) =>
              setWindowSettings((prev) => ({
                ...prev,
                servant_attendance_window_weeks: e.target.value === "" ? null : Number(e.target.value),
              }))
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
      <p className="text-sm text-[#666] mb-2">
        Per-proximity thresholds for the Dashboard&rsquo;s &ldquo;Outreach Needed&rdquo; cards. A member is flagged
        once, as of today, their current run of consecutive absences has reached the minimum below, and their most
        recent outreach (or lack of any) is older than the outreach-staleness window.
      </p>
      <p className="text-sm text-[#666] mb-4">
        These cards clear themselves automatically &mdash; no one needs to dismiss them by hand. A card disappears
        the moment the member shows up again, or as soon as any servant logs a new outreach entry for them.
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

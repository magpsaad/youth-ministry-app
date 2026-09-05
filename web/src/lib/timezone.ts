/** The ministry's home timezone -- matches the SQL-side default
 * (`coalesce(app_settings.timezone, 'America/New_York')`, see
 * is_service_day()/checkin_today() in supabase/migrations). Client
 * components displaying an already-fetched timestamp/date don't have easy
 * access to the configured app_settings.timezone value, so this constant
 * is the practical single-tenant fallback everywhere on the display side --
 * every "which calendar day is this" or "how do we show this instant"
 * question should resolve against this, never the viewer's own browser
 * timezone (which could be anything, especially checked from a different
 * device/location than the ministry itself). */
export const EASTERN_TIMEZONE = "America/New_York";

/** "YYYY-MM-DD" for the given instant, in EASTERN_TIMEZONE. Use this
 * instead of `isoString.slice(0, 10)`, which reads the UTC calendar date
 * embedded in the ISO string and silently misdates anything that happened
 * in the evening Eastern time (UTC has already rolled to the next day by
 * then) -- the exact bug that mis-dated real service attendance. */
export function easternDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** "YYYY-MM-DD" for right now, in EASTERN_TIMEZONE. Use this instead of
 * `new Date().toISOString().slice(0, 10)` -- that reads the UTC calendar
 * date, which is a day ahead of Eastern for several hours every evening
 * (Eastern time is always behind UTC). */
export function todayEastern(): string {
  return easternDateKey(new Date().toISOString());
}

/** Formats an instant for display, always in EASTERN_TIMEZONE regardless of
 * the viewer's own device/browser timezone (locale/format style still
 * follows the browser via the `undefined` locale argument -- only the
 * timezone is pinned). */
export function formatEasternDateTime(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString(undefined, { ...options, timeZone: EASTERN_TIMEZONE });
}

/** Formats a pure "YYYY-MM-DD" calendar-date key (already Eastern, e.g. from
 * easternDateKey) for display. Anchors it as UTC noon-of-day purely for
 * formatting so the viewer's own browser timezone can never shift it onto
 * an adjacent calendar day -- a date-only key has no "instant" to convert. */
export function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
}

/** The UTC instant of midnight at the start of `dateStr` ("YYYY-MM-DD") in
 * EASTERN_TIMEZONE, as an ISO string -- DST-aware (EDT is UTC-4, EST is
 * UTC-5; which one applies depends on the date). Use this to build a
 * `timestamptz` range filter for "this Eastern calendar day," instead of
 * handing a bare "YYYY-MM-DD" string straight to a `.gte`/`.lte` query --
 * Postgres/PostgREST would otherwise interpret that naive string in the
 * database session's own timezone (UTC on Supabase), silently shifting the
 * filter boundary by 4-5 hours. */
export function easternMidnightUtcIso(dateStr: string): string {
  // Midday UTC on this date is guaranteed to still fall on the same Eastern
  // calendar day (Eastern is always behind UTC), so it's a safe probe point
  // for reading that date's actual UTC offset (handles DST either way).
  const probe = new Date(`${dateStr}T12:00:00.000Z`);
  const offsetName =
    new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TIMEZONE, timeZoneName: "shortOffset" })
      .formatToParts(probe)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const offsetHours = parseInt(offsetName.replace("GMT", ""), 10) || -5;

  const midnightUtc = new Date(`${dateStr}T00:00:00.000Z`);
  midnightUtc.setUTCHours(midnightUtc.getUTCHours() - offsetHours);
  return midnightUtc.toISOString();
}

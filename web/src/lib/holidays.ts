export type HolidayDate = { title: string; startDate: string; endDate: string }; // dates: YYYY-MM-DD (Gregorian)

/** An Admin-added custom feast/fast rule (holiday_rules table) -- see
 * migration 0020. Either a fixed Gregorian-equivalent date, or an offset
 * from that year's Orthodox Pascha, each optionally spanning multiple days. */
export type HolidayRule = {
  id: string;
  title: string;
  basis: "fixed" | "pascha";
  start_month: number | null;
  start_day: number | null;
  start_offset: number | null;
  duration_days: number;
  is_active: boolean;
};

/**
 * Orthodox/Coptic Pascha (Easter) via the Meeus Julian algorithm --
 * computes the date in the Julian calendar, then adds 13 days to convert
 * to the Gregorian calendar (valid 1900-2099, which comfortably covers
 * this app's foreseeable use). REQUIREMENTS.md §6.8 -- computed
 * algorithmically so this never needs a hardcoded cutoff year again (the
 * old app's table stopped at 2035).
 */
function orthodoxPascha(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3 = March, 4 = April (Julian)
  const day = ((d + e + 114) % 31) + 1;
  const julian = new Date(Date.UTC(year, month - 1, day));
  julian.setUTCDate(julian.getUTCDate() + 13); // Julian -> Gregorian offset, 1900-2099
  return julian;
}

/** Western/Gregorian Easter (Anonymous/Meeus Gregorian algorithm) -- used
 * for Canadian statutory Good Friday, which follows the Western calendar,
 * not the Orthodox one above (the two dates frequently differ). */
function gregorianEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** nth (1-indexed) given weekday of a month -- e.g. "3rd Monday of February". */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

/** The given weekday on or before a fixed day -- e.g. "Monday on or before May 24". */
function weekdayOnOrBefore(year: number, month: number, day: number, weekday: number): Date {
  const d = new Date(Date.UTC(year, month, day));
  const diff = (d.getUTCDay() - weekday + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function singleDay(title: string, date: string): HolidayDate {
  return { title, startDate: date, endDate: date };
}

/**
 * A standard, commonly-observed Coptic Orthodox liturgical set -- the
 * major fixed-date feasts (approximate Gregorian-equivalent dates, as
 * commonly cited; a few can shift by a day around the Coptic calendar's
 * own leap year, a known simplification) plus the Pascha-relative movable
 * feasts, computed algorithmically. Intended as a starting point to
 * review/adjust, per the owner's explicit choice over providing an exact
 * custom list.
 */
export function computeHolidaysForYear(year: number): HolidayDate[] {
  const pascha = orthodoxPascha(year);

  return [
    singleDay("Nativity (Christmas)", `${year}-01-07`),
    singleDay("Theophany (Epiphany)", `${year}-01-19`),
    singleDay("Presentation in the Temple", `${year}-02-15`),
    singleDay("Annunciation", `${year}-04-07`),
    singleDay("Palm Sunday", toISO(addDays(pascha, -7))),
    singleDay("Good Friday (Coptic)", toISO(addDays(pascha, -2))),
    singleDay("Pascha (Easter)", toISO(pascha)),
    singleDay("Ascension", toISO(addDays(pascha, 39))),
    singleDay("Pentecost", toISO(addDays(pascha, 49))),
    singleDay("Nayrouz (Coptic New Year)", `${year}-09-11`),
    singleDay("Feast of the Cross", `${year}-09-27`),
  ].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Ontario statutory holidays (this ministry's home province) -- computed
 * algorithmically (fixed dates and "nth weekday of month" rules), so it
 * never needs manual re-entry year to year. Good Friday here is the
 * Western/Gregorian one (the civic holiday), separate from the Coptic
 * Good Friday above -- the two commonly fall on different dates.
 */
export function computeCanadianHolidaysForYear(year: number): HolidayDate[] {
  const easter = gregorianEaster(year);

  return [
    singleDay("New Year's Day", `${year}-01-01`),
    singleDay("Family Day", toISO(nthWeekdayOfMonth(year, 1, 1, 3))), // 3rd Monday of February
    singleDay("Good Friday (Canada)", toISO(addDays(easter, -2))),
    singleDay("Victoria Day", toISO(weekdayOnOrBefore(year, 4, 24, 1))), // Monday on/before May 24
    singleDay("Canada Day", `${year}-07-01`),
    singleDay("Labour Day", toISO(nthWeekdayOfMonth(year, 8, 1, 1))), // 1st Monday of September
    singleDay("Thanksgiving (Canada)", toISO(nthWeekdayOfMonth(year, 9, 1, 2))), // 2nd Monday of October
    singleDay("Remembrance Day", `${year}-11-11`),
    singleDay("Christmas Day", `${year}-12-25`),
    singleDay("Boxing Day", `${year}-12-26`),
  ].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Computes each active custom Admin-added rule's actual date(s) for a
 * given year -- see holiday_rules (migration 0020). */
export function computeCustomHolidaysForYear(year: number, rules: HolidayRule[]): HolidayDate[] {
  return rules
    .filter((r) => r.is_active)
    .map((r) => {
      const start =
        r.basis === "fixed"
          ? new Date(Date.UTC(year, r.start_month! - 1, r.start_day!))
          : addDays(orthodoxPascha(year), r.start_offset!);
      const end = addDays(start, r.duration_days - 1);
      return { title: r.title, startDate: toISO(start), endDate: toISO(end) };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

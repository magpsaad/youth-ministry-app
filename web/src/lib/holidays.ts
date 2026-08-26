export type HolidayDate = { title: string; date: string }; // date: YYYY-MM-DD (Gregorian)

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

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
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
    { title: "Nativity (Christmas)", date: `${year}-01-07` },
    { title: "Theophany (Epiphany)", date: `${year}-01-19` },
    { title: "Presentation in the Temple", date: `${year}-02-15` },
    { title: "Annunciation", date: `${year}-04-07` },
    { title: "Palm Sunday", date: toISO(addDays(pascha, -7)) },
    { title: "Good Friday", date: toISO(addDays(pascha, -2)) },
    { title: "Pascha (Easter)", date: toISO(pascha) },
    { title: "Ascension", date: toISO(addDays(pascha, 39)) },
    { title: "Pentecost", date: toISO(addDays(pascha, 49)) },
    { title: "Nayrouz (Coptic New Year)", date: `${year}-09-11` },
    { title: "Feast of the Cross", date: `${year}-09-27` },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

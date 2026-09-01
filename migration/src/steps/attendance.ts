import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { readTabAsRows } from "../sheets.js";
import { COHORT_FILES, SERVANTS_FILE_ID, TABS } from "../sheetIds.js";
import { serviceDateFromTimestamp } from "../normalize.js";
import { count, flagUnmatched } from "../report.js";
import type { ServantLookup } from "../lookups.js";

const CHECKIN_NAME_COL = "Select your name from the list";

/** MIGRATION_PLAN.md §3.8 -- current-year raw check-in log only (the
 * formula-derived weekly-grid/computed-roster tabs are NOT read here -- the
 * new app computes those same numbers dynamically, same as new data). */
export async function migrateAttendance(memberIdsByFile: Map<string, Map<string, string>>, servants: ServantLookup): Promise<void> {
  // Clearing happens once, upfront, in clear.ts -- see its comment for why.
  let total = 0;

  for (const file of COHORT_FILES) {
    const memberIds = memberIdsByFile.get(file.fileId)!;
    const rows = await readTabAsRows(file.fileId, TABS.checkins);
    console.log(`${file.label} Check-ins: ${rows.length} rows found.`);
    const records: Record<string, unknown>[] = [];
    const seen = new Set<string>(); // dedupe same member+date within one tab (unique constraint)

    for (const r of rows) {
      const name = (r[CHECKIN_NAME_COL] ?? "").trim();
      const memberId = memberIds.get(name.toLowerCase());
      const serviceDate = serviceDateFromTimestamp(r["Timestamp"] ?? "");
      if (!memberId) {
        flagUnmatched("attendance_records", `${name} (${file.label})`, "check-in name not found in that cohort's roster");
        continue;
      }
      if (!serviceDate) {
        flagUnmatched("attendance_records", `${name} (${file.label})`, `unparseable timestamp "${r["Timestamp"]}"`);
        continue;
      }
      const key = `${memberId}|${serviceDate}`;
      if (seen.has(key)) continue; // multiple check-ins same day -- keep one
      seen.add(key);
      records.push({
        attendee_type: "member",
        member_id: memberId,
        service_date: serviceDate,
        legacy_source_ref: `${file.fileId}:${TABS.checkins}:${key}`,
      });
    }

    if (!config.dryRun && records.length > 0) {
      const { error } = await supabase.from("attendance_records").insert(records);
      if (error) throw new Error(`Failed to insert attendance for ${file.label}: ${error.message}`);
    }
    total += records.length;
  }

  // Servant check-ins, same shape, resolved against the servant lookup
  // instead of a per-file member roster.
  const servantRows = await readTabAsRows(SERVANTS_FILE_ID, TABS.servantsCheckins);
  console.log(`Servants Check-ins: ${servantRows.length} rows found.`);
  const servantRecords: Record<string, unknown>[] = [];
  const seenServant = new Set<string>();

  for (const r of servantRows) {
    const name = (r[CHECKIN_NAME_COL] ?? "").trim();
    const nameKey = name.toLowerCase();
    const matches = servants.byName.get(nameKey);
    const serviceDate = serviceDateFromTimestamp(r["Timestamp"] ?? "");
    if (!matches || matches.length !== 1) {
      flagUnmatched(
        "attendance_records",
        `${name} (Servants)`,
        !matches || matches.length === 0 ? "no servant with this name" : `matches ${matches.length} different servants`,
      );
      continue;
    }
    if (!serviceDate) {
      flagUnmatched("attendance_records", `${name} (Servants)`, `unparseable timestamp "${r["Timestamp"]}"`);
      continue;
    }
    const key = `${matches[0]}|${serviceDate}`;
    if (seenServant.has(key)) continue;
    seenServant.add(key);
    servantRecords.push({
      attendee_type: "servant",
      servant_id: matches[0],
      service_date: serviceDate,
      legacy_source_ref: `${SERVANTS_FILE_ID}:${TABS.servantsCheckins}:${key}`,
    });
  }

  if (!config.dryRun && servantRecords.length > 0) {
    const { error } = await supabase.from("attendance_records").insert(servantRecords);
    if (error) throw new Error(`Failed to insert servant attendance: ${error.message}`);
  }
  total += servantRecords.length;

  count("attendance_records", total);
}

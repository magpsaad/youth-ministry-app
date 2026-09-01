import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { readTabAsRows } from "../sheets.js";
import { CALENDAR_FILE_ID, TABS } from "../sheetIds.js";
import { isKnownCalendarEventType } from "../normalize.js";
import { count, flagUnmatched } from "../report.js";
import { resolveServantByName, type ServantLookup } from "../lookups.js";

/** MIGRATION_PLAN.md §3.9. Attachment column deferred (Drive-hosted, same
 * as photos -- not this pass). */
export async function migrateCalendar(servants: ServantLookup): Promise<void> {
  // Clearing happens once, upfront, in clear.ts -- see its comment for why.

  const rows = await readTabAsRows(CALENDAR_FILE_ID, TABS.calendar);
  console.log(`Calendar: ${rows.length} rows found.`);

  const records = [];
  for (const r of rows) {
    const title = (r["Title"] ?? "").trim();
    const type = (r["Type"] ?? "").trim();
    if (!isKnownCalendarEventType(type)) {
      flagUnmatched("service_calendar_events", title, `Type "${type}" doesn't match the app's fixed enum`);
      continue;
    }
    const createdByName = (r["Created By"] ?? "").trim();
    const createdBy = resolveServantByName(servants, createdByName);
    if (!createdBy.id) {
      flagUnmatched("service_calendar_events", title, `Created By "${createdByName}": ${createdBy.reason}`);
      continue;
    }
    const startTime = r["Start Time"]?.trim() || null;
    records.push({
      title,
      description: r["Description"]?.trim() || null,
      event_type: type,
      start_date: r["Start Date"]?.trim() || null,
      end_date: r["End Date"]?.trim() || r["Start Date"]?.trim() || null,
      all_day: !startTime,
      start_time: startTime,
      end_time: r["End Time"]?.trim() || null,
      location: r["Location"]?.trim() || null,
      created_by: createdBy.id,
      legacy_source_ref: `${CALENDAR_FILE_ID}:${TABS.calendar}:${r["Event ID"] ?? title}`,
    });
  }

  if (!config.dryRun && records.length > 0) {
    const { error } = await supabase.from("service_calendar_events").insert(records);
    if (error) throw new Error(`Failed to insert calendar events: ${error.message}`);
  }
  count("service_calendar_events", records.length);
}

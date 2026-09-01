import { supabase } from "./supabase.js";

/** MIGRATION_PLAN.md §4 -- the wipe-and-reload, done as one upfront pass in
 * strict foreign-key dependency order (children before parents), rather
 * than each step clearing its own table right before reloading it. That
 * per-step approach broke on a real run: universities.ts tried to delete
 * `universities` while `members` (leftover test data already sitting in
 * qa) still referenced it via members.university_id, and Postgres
 * correctly refused. Clearing everything up front, in the right order,
 * sidesteps that regardless of what state the tables happen to be in.
 *
 * Only attendance_records/outreach_entries -> members -> universities are
 * real inter-dependencies among the tables this tool clears (their other
 * foreign keys point at profiles/groups, which this tool never clears) --
 * verses/service_calendar_events/audit_log have no ordering constraint
 * relative to the others, but are included here for one single clear pass
 * rather than scattered per-step deletes.
 */
export async function clearContentTables(): Promise<void> {
  const tables = [
    "attendance_records",
    "outreach_entries",
    "members",
    "universities",
    "verses",
    "service_calendar_events",
    "audit_log",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().not("id", "is", null);
    if (error) {
      throw new Error(
        `Failed to clear ${table}: ${error.message}` +
          (table === "audit_log"
            ? " -- has migration 0034_audit_log_legacy_ref.sql been run in the Supabase SQL editor yet?"
            : ""),
      );
    }
  }
}

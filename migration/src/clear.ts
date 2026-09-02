import { supabase } from "./supabase.js";
import { config } from "./config.js";

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

/** Same wipe-and-reload philosophy as clearContentTables(), extended to the
 * photos bucket -- confirmed with the owner explicitly (this is the one
 * genuinely hard-to-reverse part of that philosophy: Storage has no
 * trash/undo). Members get fresh UUIDs every run, so member-owned photo
 * objects from a prior run are unrecoverable garbage anyway once orphaned;
 * servant photo objects are also fully overwritten each run for the same
 * reason ensureProfile() already overwrites a servant's name/phone/gender
 * from Sheets unconditionally -- Sheets/Drive is the source of truth for
 * the whole person record, photo included, not just the DB fields. */
export async function clearPhotosBucket(): Promise<void> {
  const bucket = `${config.schema}-photos`;
  const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1000 });
  if (error) throw new Error(`Failed to list ${bucket} for clearing: ${error.message}`);
  if (data && data.length > 0) {
    const { error: delErr } = await supabase.storage.from(bucket).remove(data.map((f) => f.name));
    if (delErr) throw new Error(`Failed to clear ${bucket}: ${delErr.message}`);
  }
}

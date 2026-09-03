import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { readTabAsRows } from "../sheets.js";
import { CALENDAR_FILE_ID, TABS } from "../sheetIds.js";
import { AUDIT_ACTION_TYPE_MAP, parseLocalDateTimeToUtcIso, APP_TIMEZONE } from "../normalize.js";
import { count, flagUnmatched } from "../report.js";
import type { ServantLookup } from "../lookups.js";

const YEAR_TO_POSITION: Record<string, number> = {
  YEAR_1: 1,
  YEAR_2: 2,
  YEAR_3: 3,
  YEAR_4: 4,
  YEAR_5: 5,
};

/** MIGRATION_PLAN.md §3.10 -- new in this pass; needs migration 0034's
 * legacy_source_ref column to already be applied, or the delete/insert
 * below will fail loudly (no such column) rather than silently skip. */
export async function migrateAuditLog(groupsByPosition: Map<number, string>, servants: ServantLookup): Promise<void> {
  // Clearing happens once, upfront, in clear.ts -- see its comment for why.
  const rows = await readTabAsRows(CALENDAR_FILE_ID, TABS.auditLog);
  console.log(`Audit Log: ${rows.length} rows found.`);

  const records = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const oldActionType = (r["Action Type"] ?? "").trim();
    const newActionType = AUDIT_ACTION_TYPE_MAP[oldActionType];
    const timestamp = (r["Timestamp"] ?? "").trim();
    if (!newActionType) {
      flagUnmatched("audit_log", `${timestamp} ${oldActionType}`, "no mapping for this old action type");
      continue;
    }

    const userEmail = (r["User Email"] ?? "").trim().toLowerCase();
    const userId = userEmail ? servants.byEmail.get(userEmail) ?? null : null;
    if (userEmail && !userId) {
      flagUnmatched("audit_log", `${timestamp} ${oldActionType}`, `User Email "${userEmail}" not found among provisioned accounts`);
    }

    const yearRaw = (r["Year"] ?? "").trim();
    const position = YEAR_TO_POSITION[yearRaw];
    const groupId = position ? groupsByPosition.get(position) ?? null : null;

    let details: Record<string, unknown> | null = null;
    if (r["Details"]) {
      try {
        details = JSON.parse(r["Details"]);
      } catch {
        details = { raw: r["Details"] }; // not valid JSON in source -- keep it, don't drop the row
      }
    }
    // Owner-confirmed real scenario: a genuine access attempt whose email
    // doesn't match anyone provisioned (e.g. someone signed up with a
    // different email than the one they later tried to log in with) is
    // still a real historical event worth keeping, not something to drop or
    // silently null out -- but user_id has to be null (there's truly no
    // matching account), and the app's own Audit Logs screen has nothing
    // else to show in that case (web/src/components/admin/
    // AuditLogsInteractive.tsx falls back to details.unmatched_email, added
    // alongside this). Keep whatever real Details content already existed.
    if (userEmail && !userId) {
      details = { ...details, unmatched_email: userEmail };
    }

    // Owner-reported (same bug as outreach's "Date & Time"): occurred_at is
    // timestamptz, but the sheet gives a naive local datetime string --
    // inserted as-is, Postgres reads it as UTC and shifts every value by
    // the zone's offset. See parseLocalDateTimeToUtcIso.
    const occurredAt = timestamp ? parseLocalDateTimeToUtcIso(timestamp, APP_TIMEZONE) : null;
    if (timestamp && !occurredAt) {
      flagUnmatched("audit_log", `${timestamp} ${oldActionType}`, `unparseable "Timestamp" value "${timestamp}"`);
    }

    records.push({
      occurred_at: occurredAt,
      user_id: userId,
      action_type: newActionType,
      group_id: groupId,
      details,
      // Row index, not timestamp/actionType/email -- real data has multiple
      // audit rows sharing all three (e.g. the same failed-login attempt
      // logged more than once), which collided against uq_audit_log_legacy_ref.
      // Row position is trivially unique regardless of that.
      legacy_source_ref: `${CALENDAR_FILE_ID}:${TABS.auditLog}:row${i}`,
    });
  }

  if (!config.dryRun && records.length > 0) {
    const { error } = await supabase.from("audit_log").insert(records);
    if (error) throw new Error(`Failed to insert audit_log: ${error.message}`);
  }
  count("audit_log", records.length);
}

import { config } from "./config.js";
import { loadGroupsByLadderPosition } from "./lookups.js";
import { migrateUniversities } from "./steps/universities.js";
import { migrateVerses } from "./steps/verses.js";
import { migrateServants } from "./steps/servants.js";
import { migrateMembers } from "./steps/members.js";
import { migrateOutreach } from "./steps/outreach.js";
import { migrateAttendance } from "./steps/attendance.js";
import { migrateCalendar } from "./steps/calendar.js";
import { migrateAuditLog } from "./steps/auditLog.js";
import { printReport, hasUnmatched } from "./report.js";

// Order matters: groups/universities/servants must exist (or have their
// dry-run placeholder ids) before anything that references them by lookup.
async function main() {
  const groupsByPosition = await loadGroupsByLadderPosition();

  const universitiesByName = await migrateUniversities();
  await migrateVerses();

  const servants = await migrateServants(groupsByPosition);
  const memberIdsByFile = await migrateMembers(groupsByPosition, universitiesByName, servants);
  await migrateOutreach(memberIdsByFile, servants);
  await migrateAttendance(memberIdsByFile, servants);
  await migrateCalendar(servants);
  await migrateAuditLog(groupsByPosition, servants);

  printReport();

  if (config.dryRun) {
    console.log("\nThis was a DRY RUN -- nothing was written. Re-run with --run to actually migrate.");
  } else if (hasUnmatched()) {
    console.log("\nRun complete, but see the unmatched rows above -- nothing was guessed for those.");
  } else {
    console.log("\nRun complete.");
  }
}

main().catch((err) => {
  console.error("\nMigration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

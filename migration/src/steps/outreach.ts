import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { readTabAsRows } from "../sheets.js";
import { COHORT_FILES, TABS } from "../sheetIds.js";
import { normalizeOutreachType } from "../normalize.js";
import { count, flagUnmatched } from "../report.js";
import { resolveServantByName, resolveByName, type ServantLookup } from "../lookups.js";

/** MIGRATION_PLAN.md §3.7 -- one Outreach tab per cohort file, member
 * looked up within that same file's own roster (memberIdsByFile). */
export async function migrateOutreach(memberIdsByFile: Map<string, Map<string, string[]>>, servants: ServantLookup): Promise<void> {
  // Clearing happens once, upfront, in clear.ts -- see its comment for why.

  let total = 0;
  for (const file of COHORT_FILES) {
    const memberIds = memberIdsByFile.get(file.fileId)!;
    const rows = await readTabAsRows(file.fileId, TABS.outreach);
    console.log(`${file.label} Outreach: ${rows.length} rows found.`);

    const records: Record<string, unknown>[] = [];
    rows.forEach((r, i) => {
      const youthName = (r["Youth Name"] ?? "").trim();
      const servantName = (r["Servant"] ?? "").trim();
      const resolvedMember = resolveByName(memberIds, youthName, "member");
      if (!resolvedMember.id) {
        flagUnmatched("outreach_entries", `${youthName} (${file.label})`, `Youth Name: ${resolvedMember.reason}`);
        return;
      }
      const resolvedServant = resolveServantByName(servants, servantName);
      if (!resolvedServant.id) {
        flagUnmatched("outreach_entries", `${youthName} (${file.label})`, `Servant "${servantName}": ${resolvedServant.reason}`);
        return;
      }
      records.push({
        member_id: resolvedMember.id,
        servant_id: resolvedServant.id,
        occurred_at: r["Date & Time"]?.trim() || null,
        type: normalizeOutreachType(r["Type"]),
        notes: r["Notes"]?.trim() || null,
        follow_up_due: r["Follow-up Due"]?.trim() || null,
        follow_up_dismissed_at: r["Follow-up Dismissed"]?.trim() || null,
        legacy_source_ref: `${file.fileId}:${TABS.outreach}:row${i}`,
      });
    });

    if (!config.dryRun && records.length > 0) {
      const { error } = await supabase.from("outreach_entries").insert(records);
      if (error) throw new Error(`Failed to insert outreach for ${file.label}: ${error.message}`);
    }
    total += records.length;
  }
  count("outreach_entries", total);
}

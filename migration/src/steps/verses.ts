import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { readTab } from "../sheets.js";
import { ADMIN_FILE_ID, TABS } from "../sheetIds.js";
import { count } from "../report.js";

/** MIGRATION_PLAN.md §3.3 -- single unnamed column, no header row assumed
 * (readTab, not readTabAsRows -- the tab is just a bare list of quotes). */
export async function migrateVerses(): Promise<void> {
  const rows = await readTab(ADMIN_FILE_ID, TABS.verses);
  const texts = rows.map((r) => (r[0] ?? "").trim()).filter(Boolean);
  console.log(`Verses: ${texts.length} rows found in Sheets.`);

  if (!config.dryRun) {
    const { error: delErr } = await supabase.from("verses").delete().not("id", "is", null);
    if (delErr) throw new Error(`Failed to clear verses: ${delErr.message}`);

    const { error: insErr } = await supabase.from("verses").insert(
      texts.map((text) => ({ text, legacy_source_ref: `${ADMIN_FILE_ID}:${TABS.verses}:${text.slice(0, 40)}` })),
    );
    if (insErr) throw new Error(`Failed to insert verses: ${insErr.message}`);
  }
  count("verses", texts.length);
}

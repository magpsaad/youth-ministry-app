import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { readTabAsRows } from "../sheets.js";
import { ADMIN_FILE_ID, TABS } from "../sheetIds.js";
import { count } from "../report.js";

/** MIGRATION_PLAN.md §3.2 -- wiped and reloaded every refresh. Returns a
 * name->id map: real ids in --run mode (from the fresh insert), synthetic
 * "dry:<name>" placeholder ids in --dry-run mode (never written anywhere,
 * just lets downstream steps check "does this name resolve" identically in
 * both modes without branching on config.dryRun everywhere). */
export async function migrateUniversities(): Promise<Map<string, string>> {
  const rows = await readTabAsRows(ADMIN_FILE_ID, TABS.universities);
  console.log(`Universities: ${rows.length} rows found in Sheets.`);

  const records = rows
    .map((r) => ({
      name: (r["University Name"] ?? "").trim(),
      proximity: (r["Proximity"] ?? "").trim(),
    }))
    .filter((r) => r.name && (r.proximity === "Local" || r.proximity === "Regional" || r.proximity === "Abroad"));

  const byName = new Map<string, string>();

  if (config.dryRun) {
    for (const r of records) byName.set(r.name.toLowerCase(), `dry:${r.name}`);
  } else {
    // Clearing happens once, upfront, in clear.ts -- see its comment for why.
    const { data, error: insErr } = await supabase
      .from("universities")
      .insert(
        records.map((r) => ({
          name: r.name,
          proximity: r.proximity,
          legacy_source_ref: `${ADMIN_FILE_ID}:${TABS.universities}:${r.name}`,
        })),
      )
      .select("id, name");
    if (insErr) throw new Error(`Failed to insert universities: ${insErr.message}`);
    for (const u of data ?? []) byName.set(u.name.toLowerCase(), u.id);
  }

  count("universities", records.length);
  return byName;
}

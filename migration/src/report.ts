type Unmatched = { table: string; source: string; reason: string };

const counts: Record<string, number> = {};
const unmatched: Unmatched[] = [];

export function count(table: string, n = 1) {
  counts[table] = (counts[table] ?? 0) + n;
}

export function flagUnmatched(table: string, source: string, reason: string) {
  unmatched.push({ table, source, reason });
}

export function printReport() {
  console.log("\n=== Migration report ===\n");
  console.log("Rows written per table:");
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table}: ${n}`);
  }
  if (unmatched.length === 0) {
    console.log("\nNo unmatched rows. ✓");
    return;
  }
  console.log(`\n${unmatched.length} unmatched row(s) -- nothing was guessed, review these manually:\n`);
  for (const u of unmatched) {
    console.log(`  [${u.table}] ${u.source} -- ${u.reason}`);
  }
}

export function hasUnmatched() {
  return unmatched.length > 0;
}

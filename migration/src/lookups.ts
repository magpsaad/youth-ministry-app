import { supabase } from "./supabase.js";

/** MIGRATION_PLAN.md §3.1 -- groups already exist in the live DB, resolved
 * by ladder_position at run time, never created/touched by this tool. */
export async function loadGroupsByLadderPosition(): Promise<Map<number, string>> {
  const { data, error } = await supabase.from("groups").select("id, ladder_position").eq("is_archived", false);
  if (error) throw new Error(`Failed to load groups: ${error.message}`);

  const map = new Map<number, string>();
  for (const g of data) {
    const pos = g.ladder_position >= 5 ? 5 : g.ladder_position;
    if (map.has(pos)) {
      throw new Error(
        `More than one non-archived group at ladder_position ${pos} -- can't resolve which one is "Yr${pos === 5 ? "5+" : pos} Ministry". Fix in the app before running.`,
      );
    }
    map.set(pos, g.id);
  }
  for (let pos = 0; pos <= 5; pos++) {
    if (!map.has(pos)) {
      throw new Error(`No group found at ladder_position ${pos} -- run Group Transition setup in the app first.`);
    }
  }
  return map;
}

export type ServantLookup = {
  byEmail: Map<string, string>; // lowercased email -> profiles.id
  byName: Map<string, string[]>; // lowercased full name -> profiles.id[] (array to detect collisions)
};

export function buildServantLookup(entries: { id: string; full_name: string; email: string | null }[]): ServantLookup {
  const byEmail = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const e of entries) {
    if (e.email) byEmail.set(e.email.trim().toLowerCase(), e.id);
    const nameKey = e.full_name.trim().toLowerCase();
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), e.id]);
  }
  return { byEmail, byName };
}

/** Returns the single matching profile id, or null with a reason if it's
 * ambiguous/missing -- callers flag the reason via report.flagUnmatched
 * rather than guess. */
export function resolveServantByName(lookup: ServantLookup, name: string): { id: string | null; reason?: string } {
  const key = name.trim().toLowerCase();
  if (!key) return { id: null, reason: "blank name" };
  const matches = lookup.byName.get(key);
  if (!matches || matches.length === 0) return { id: null, reason: `no servant named "${name}"` };
  if (matches.length > 1) return { id: null, reason: `"${name}" matches ${matches.length} different servants` };
  return { id: matches[0] };
}

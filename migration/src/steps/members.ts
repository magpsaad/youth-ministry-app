import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { readTabAsRows } from "../sheets.js";
import { COHORT_FILES, TABS } from "../sheetIds.js";
import { normalizePhone, normalizeGender, isTruthyYes } from "../normalize.js";
import { count, flagUnmatched } from "../report.js";
import { resolveServantByName, type ServantLookup } from "../lookups.js";

/** MIGRATION_PLAN.md §3.6 -- one Roster tab per cohort file. Returns a
 * per-cohort-file "name -> member id" lookup for outreach.ts (Outreach's
 * Youth Name is matched within that same file's own roster). */
export async function migrateMembers(
  groupsByPosition: Map<number, string>,
  universitiesByName: Map<string, string>,
  servants: ServantLookup,
): Promise<Map<string, Map<string, string>>> {
  // Clearing happens once, upfront, in clear.ts -- see its comment for why.
  const memberIdsByFile = new Map<string, Map<string, string>>();

  for (const file of COHORT_FILES) {
    const groupId = groupsByPosition.get(file.ladderPosition)!;
    const rows = await readTabAsRows(file.fileId, TABS.roster);
    console.log(`${file.label} Roster: ${rows.length} rows found.`);

    const records = rows.map((r) => {
      const fullName = (r["Full Name"] ?? "").trim();
      const universityName = (r["University or College Name"] ?? "").trim();
      const universityId = universityName ? universitiesByName.get(universityName.toLowerCase()) ?? null : null;
      if (universityName && !universityId) {
        flagUnmatched("members", `${fullName} (${file.label})`, `university "${universityName}" not found`);
      }

      const assignedServantName = (r["Assigned Servant"] ?? "").trim();
      let assignedServantId: string | null = null;
      if (assignedServantName) {
        const resolved = resolveServantByName(servants, assignedServantName);
        if (resolved.id) assignedServantId = resolved.id;
        else flagUnmatched("members", `${fullName} (${file.label})`, `Assigned Servant "${assignedServantName}": ${resolved.reason}`);
      }

      return {
        legacyRef: `${file.fileId}:${TABS.roster}:${fullName}`,
        full_name: fullName,
        phone: normalizePhone(r["Phone Number"]),
        email: r["Email Address"]?.trim() || null,
        university_id: universityId,
        program_of_study: r["Program of Study"]?.trim() || null,
        date_of_birth: r["Date of Birth"]?.trim() || null,
        father_of_confession: r["Father of Confession"]?.trim() || null,
        home_address: r["Home Address"]?.trim() || null,
        is_visitor: isTruthyYes(r["Visitor"]),
        gender: normalizeGender(r["Gender"]),
        registration_comments: r["Youth Comments"]?.trim() || null,
        assigned_servant_id: assignedServantId,
        servant_comments: r["Servant Comments"]?.trim() || null,
        is_new_assignment: isTruthyYes(r["New Assisgnment"]),
        group_id: groupId,
        legacy_source_ref: `${file.fileId}:${TABS.roster}:${fullName}`,
      };
    });

    const fileMemberIds = new Map<string, string>();
    if (config.dryRun) {
      for (const rec of records) fileMemberIds.set(rec.full_name.toLowerCase(), `dry:${rec.full_name}`);
    } else {
      const { data, error } = await supabase.from("members").insert(records).select("id, full_name");
      if (error) throw new Error(`Failed to insert members for ${file.label}: ${error.message}`);
      for (const m of data ?? []) fileMemberIds.set(m.full_name.toLowerCase(), m.id);
    }
    memberIdsByFile.set(file.fileId, fileMemberIds);
    count("members", records.length);
  }

  return memberIdsByFile;
}

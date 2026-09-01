import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { readTabAsRows } from "../sheets.js";
import { ADMIN_FILE_ID, SERVANTS_FILE_ID, TABS } from "../sheetIds.js";
import { normalizePhone, normalizeGender, GENERAL_COORDINATOR_EMAILS } from "../normalize.js";
import { count, flagUnmatched } from "../report.js";
import type { ServantLookup } from "../lookups.js";

type Grant = { role: "admin" | "general_coordinator" | "sub_coordinator" | "servant" | "read_only"; groupId: string | null };

type PlannedPerson = {
  name: string;
  email: string;
  phone: string | null;
  gender: "Male" | "Female" | null;
  fatherOfConfession: string | null;
  grants: Grant[];
};

const ACCESS_YEAR_COLS = ["Access Year 1", "Access Year 2", "Access Year 3", "Access Year 4", "Access Year 5"];
const SERVING_YEAR_TO_POSITION: Record<string, number> = { "Year 1": 1, "Year 2": 2, "Year 3": 3, "Year 4": 4, "Year 5": 5 };

/** MIGRATION_PLAN.md §3.5 -- the full validated role-mapping algorithm. */
function planGrants(row: Record<string, string>, groupsByPosition: Map<number, string>): Grant[] | { error: string } {
  const email = (row["Email"] ?? "").trim().toLowerCase();
  const roleRaw = (row["Role"] ?? "").trim().toLowerCase();

  if (GENERAL_COORDINATOR_EMAILS.has(email)) {
    return [{ role: "general_coordinator", groupId: null }];
  }
  if (roleRaw === "admin") {
    return [{ role: "admin", groupId: null }];
  }

  const yesPositions = ACCESS_YEAR_COLS.map((col, i) => ((row[col] ?? "").trim() ? i + 1 : null)).filter(
    (p): p is number => p !== null,
  );

  if (roleRaw === "servant" && yesPositions.length === 0) {
    return [{ role: "servant", groupId: null }]; // Unassigned servant -- a valid existing state
  }

  const primaryRole = roleRaw === "coordinator" ? "sub_coordinator" : "servant";
  const servingYear = (row["Serving Year"] ?? "").trim();
  const servingPosition = SERVING_YEAR_TO_POSITION[servingYear];

  if (yesPositions.length === 1) {
    // Only one access year -- that's just the real grant, Serving Year
    // doesn't strictly need to match (but should -- not fatal if it doesn't).
    const pos = yesPositions[0];
    const gid = groupsByPosition.get(pos === 5 ? 5 : pos);
    if (!gid) return { error: `no group at ladder_position ${pos}` };
    return [{ role: primaryRole, groupId: gid }];
  }

  // Multiple access years: Serving Year's column is the real grant, every
  // other YES column becomes read_only -- verified against the sheet's own
  // yellow/red highlighting with zero exceptions, see MIGRATION_PLAN.md §3.5.
  if (!servingPosition || !yesPositions.includes(servingPosition)) {
    return { error: `${yesPositions.length} Access Year columns marked, but Serving Year ("${servingYear}") doesn't match any of them` };
  }

  const grants: Grant[] = [];
  for (const pos of yesPositions) {
    const cappedPos = pos === 5 ? 5 : pos;
    const gid = groupsByPosition.get(cappedPos);
    if (!gid) return { error: `no group at ladder_position ${cappedPos}` };
    grants.push({ role: pos === servingPosition ? primaryRole : "read_only", groupId: gid });
  }
  return grants;
}

async function buildPlan(groupsByPosition: Map<number, string>): Promise<PlannedPerson[]> {
  const [permissions, roster] = await Promise.all([
    readTabAsRows(ADMIN_FILE_ID, TABS.permissions),
    readTabAsRows(SERVANTS_FILE_ID, TABS.servantsRoster),
  ]);

  const rosterByEmail = new Map<string, Record<string, string>>();
  for (const r of roster) {
    const email = (r["Email Address"] ?? "").trim().toLowerCase();
    if (email) rosterByEmail.set(email, r);
  }

  const plan: PlannedPerson[] = [];
  for (const row of permissions) {
    const name = (row["Name"] ?? "").trim();
    const email = (row["Email"] ?? "").trim().toLowerCase();
    if (!name || !email) {
      flagUnmatched("servants", name || email || "(blank row)", "missing name or email in Permissions sheet");
      continue;
    }

    const grantsOrError = planGrants(row, groupsByPosition);
    if ("error" in grantsOrError) {
      flagUnmatched("servants", `${name} <${email}>`, grantsOrError.error);
      continue;
    }

    const rosterRow = rosterByEmail.get(email);
    plan.push({
      name,
      email,
      phone: normalizePhone(rosterRow?.["Phone Number"]),
      gender: normalizeGender(rosterRow?.["Gender"]),
      fatherOfConfession: rosterRow?.["Father of Confession"]?.trim() || null,
      grants: grantsOrError,
    });
  }
  return plan;
}

/** Finds this person's existing profiles.id by email if already provisioned
 * (idempotent re-run), otherwise creates a real auth.users row (no email
 * sent -- admin.createUser only sends one if you pass invite-specific
 * options, which this doesn't) and its matching profiles row.
 *
 * `existingAuthUsersByEmail` is fetched ONCE upfront (see migrateServants)
 * rather than discovered by pattern-matching createUser's error after the
 * fact -- a real run surfaced that Supabase doesn't reliably return a
 * distinguishable "already exists" error code/message here (got a generic
 * "Database error creating new user" for a real pre-existing account, which
 * didn't match the expected email_exists code or wording at all). Checking
 * the real list first sidesteps guessing at Supabase's error format entirely. */
async function ensureProfile(person: PlannedPerson, existingAuthUsersByEmail: Map<string, string>): Promise<string> {
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", person.email).maybeSingle();
  if (existing) {
    await supabase
      .from("profiles")
      .update({
        full_name: person.name,
        phone: person.phone,
        gender: person.gender,
        father_of_confession: person.fatherOfConfession,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  // auth.users is shared across the WHOLE Supabase project, not per-schema
  // (REQUIREMENTS.md §1.1) -- profiles is schema-scoped, so the "existing"
  // check above only sees this schema's own profiles. Someone who already
  // has a real account (either from actually signing in during testing, or
  // from a prior run of this tool against another schema) gets reused here,
  // never recreated.
  let authUserId: string;
  const preExisting = existingAuthUsersByEmail.get(person.email);
  if (preExisting) {
    authUserId = preExisting;
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: person.email,
      email_confirm: true, // pre-confirmed -- no confirmation email sent
    });
    if (!created?.user) {
      throw new Error(`Failed to create auth user for ${person.email}: ${error?.message ?? "unknown error"}`);
    }
    authUserId = created.user.id;
  }

  const { error: profileErr } = await supabase.from("profiles").insert({
    id: authUserId,
    full_name: person.name,
    email: person.email,
    phone: person.phone,
    gender: person.gender,
    father_of_confession: person.fatherOfConfession,
    legacy_source_ref: `${ADMIN_FILE_ID}:${TABS.permissions}:${person.email}`,
  });
  if (profileErr) throw new Error(`Failed to insert profile for ${person.email}: ${profileErr.message}`);

  return authUserId;
}

/** MIGRATION_PLAN.md §3.5 -- idempotent: never deletes/recreates an
 * existing account, only adds missing grants. Returns a lookup for
 * downstream steps (members' Assigned Servant, outreach's Servant). */
export async function migrateServants(groupsByPosition: Map<number, string>): Promise<ServantLookup> {
  const plan = await buildPlan(groupsByPosition);
  console.log(`Servants/coordinators/admin: ${plan.length} people planned from Permissions.`);

  // Fetched once upfront -- see ensureProfile's comment for why this
  // replaces trying to detect "already exists" from createUser's error.
  const existingAuthUsersByEmail = new Map<string, string>();
  if (!config.dryRun) {
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw new Error(`Failed to list existing auth users: ${listErr.message}`);
    for (const u of list.users) {
      if (u.email) existingAuthUsersByEmail.set(u.email.toLowerCase(), u.id);
    }
    console.log(`Found ${existingAuthUsersByEmail.size} existing auth account(s) project-wide.`);
  }

  const byEmail = new Map<string, string>();
  const byName = new Map<string, string[]>();

  for (const person of plan) {
    let profileId: string;
    if (config.dryRun) {
      profileId = `dry:${person.email}`;
    } else {
      profileId = await ensureProfile(person, existingAuthUsersByEmail);
      for (const grant of person.grants) {
        const { error } = await supabase
          .from("user_roles")
          .upsert({ user_id: profileId, role: grant.role, group_id: grant.groupId }, { onConflict: "user_id,role,group_id", ignoreDuplicates: true });
        if (error) throw new Error(`Failed to grant ${grant.role} to ${person.email}: ${error.message}`);
      }
    }
    byEmail.set(person.email, profileId);
    const nameKey = person.name.toLowerCase();
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), profileId]);
    count("user_roles", person.grants.length);
  }
  count("profiles", plan.length);

  return { byEmail, byName };
}

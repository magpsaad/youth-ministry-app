# Data Migration Tool — Field Mapping & Design Report

**Status: decisions finalized below — nothing has been built or run yet.** Next step, unless you say otherwise: I write the actual script and a new migration (§4a), then run it in `--dry-run` mode and show you real counts/samples/unmatched rows before any real write to any database.

---

## 1. Scope of this pass

- **This tool, v1**: everything below except photos and except the 2024-25 historical attendance archives — deferred indefinitely (§6).
- **Separate, later**: photo migration (Drive → Supabase Storage).
- **Not migrated**: `actions_needed_config` — you've already set this up directly in the new app; the tool never touches it, in either the initial load or any refresh.
- **Now included** (revised from the original draft): the old app's Audit Log tab **is** migrated and refreshed going forward — see §3.10.

## 2. Source inventory (confirmed via direct inspection)

| File | Role |
|---|---|
| `25-26 SAY Yr0 Ministry` … `25-26 SAY Yr5+ Ministry` (6 files) | One per cohort/ladder-position: **Roster**, **Outreach**, **Check-in responses** (current year), **Registration responses** (raw form log, not needed). |
| `25-26 SAY Servants Ministry` | Servants roster (no role/scope data — that lives in Admin → Permissions, §3.5). Own Check-in responses tab (servant attendance). |
| `SAY Ministry Admin` | Real tab names (confirmed via direct xlsx export): **Permissions** (role+scope source), **Actions Needed Config** (not migrated, §1), **Audit Config** (old audit-type registry — reference only, not migrated as a table), **Universities**, **Verses**. |
| `SAY Ministry Audit - Calendar` | **Audit Log**, **Calendar**. |
| `SAY YrN Attendance (Responses)` (5 files) | 2024-25 history — deferred (§6), untouched in this pass. |

## 3. Field mapping, by destination table

### 3.1 `groups` — resolved by lookup, not migrated

Unchanged from the draft: the tool queries `groups where ladder_position = 0..5` (terminal) at run time, for whichever schema it's pointed at. Stops and reports rather than guessing if a position doesn't resolve to exactly one group.

### 3.2 `universities`

Unchanged: `University Name` → `name`, `Proximity` → `proximity`. 44 real + 3 wildcard rows (`* Local/Regional/Abroad University`) all migrated as real rows, since roster rows reference them by exact name.

### 3.3 `verses`

Unchanged: single column, 26 quotes → `verses.text`, `reference` left null.

### 3.4 `actions_needed_config` — excluded entirely

**Decided**: never imported, never refreshed. You've already configured this directly in the new app. Dropped from both the initial load and the wipe-and-reload scope (§4).

### 3.5 Servant accounts + roles (`profiles` + `user_roles`) — pre-provisioned, no emails sent

Real tab name confirmed: `SAY Ministry Admin` → **Permissions** (62 people: 1 admin, 13 coordinator, 48 servant). Joined against `25-26 SAY Servants Ministry` → Roster (by email) for phone/gender/Father of Confession, since Permissions doesn't carry those.

**Role mapping (finalized, validated against the real sheet):**

| Permissions row | → |
|---|---|
| `Role = admin` | `admin`, one row, `group_id` null |
| Email ∈ {`mina.awad@gmail.com` (Fr Karas Awad), `frsamuel@cccnet.ca` (Fr Samuel Zaki), `jwahba@live.com` (John Wahba)} | `general_coordinator`, one row, `group_id` null — **regardless of role string or Access Year columns** (these 3 already have all 5 Access Years marked, which is moot once they're general-coordinator: that role already implies full access, so no per-group rows of any kind get created for them) |
| `Role = coordinator`, not one of the 3 above | `sub_coordinator`, scoped to whichever `Access Year N` matches their `Serving Year` (their real grant) |
| `Role = servant` | `servant` |

**Multiple-access → read-only rule (finalized, and independently verified — not just taken on your word)**: I exported the actual spreadsheet as `.xlsx` (the text-content tools can't see cell formatting, only values) and read the real fill/font colors. Every cell you'd marked was fill `#FFFF00` / font `#FF0000` — no ambiguity, and I checked: **zero** rows have 2+ `Access Year` columns marked YES without your highlighting resolving all of them. So the rule is applied programmatically, not guessed:
- The `Access Year N` column matching the person's `Serving Year` → their real grant (`sub_coordinator` or `servant`, scoped to that group).
- Every other `YES` column → a separate `read_only` grant, scoped to that group.
- Only one `YES` column at all → that's just their one real grant, no read-only rows.
- **Zero `YES` columns, `Role = servant`** (8 people: John Boktor, Liz Attia, Mena Iskander, Mina Faheim, Nancy Moussa, Andrew Hanna, Claire Girgis, Nansy Nasralla) → `servant` with `group_id = null` — the schema already supports this exact case (`user_roles.role_group_scope_check`, migration 0014/0024) as the existing "Unassigned servant" state (REQUIREMENTS.md §4.1), not a gap.
- A `coordinator`/`servant` row with 2+ `YES` columns but no `Serving Year` set, or a `Serving Year` that doesn't match any `YES` column → goes to the unmatched-rows report (§7), not guessed.

Concretely, this resolves to (before running, so you can sanity-check the shape): **1 admin, 3 general_coordinator, 10 sub_coordinator (each with a real grant + 0-4 read-only grants), 40 servant with a real group, 8 Unassigned servant** — 62 people, matching the Permissions sheet's row count exactly.

**Mechanics (unchanged from draft)**: real `auth.users` rows created via `auth.admin.createUser` (email pre-confirmed, no password, no email sent — only the separate invite/reset calls send email, neither used), then `profiles` + `user_roles`. Idempotent — re-running never deletes/recreates an existing account, only adds/updates grants.

**Still want to test with one real account before trusting it for 62 people**: that a real later Google sign-in attaches to the pre-created `auth.users` row by verified email, rather than creating a duplicate.

### 3.6 `members`

| Source column | Destination field | Notes |
|---|---|---|
| `Full Name` | `full_name` | |
| `Phone Number` | `phone` | Normalized to `1 (416) 930-1659` |
| `Email Address` | `email` | |
| `University or College Name` | `university_id` | Lookup by name; blank → null → proximity `Unknown` |
| `Program of Study` | `program_of_study` | |
| `Date of Birth` | `date_of_birth` | |
| `Father of Confession` | `father_of_confession` | |
| `Home Address` | `home_address` | |
| `Visitor` | `is_visitor` | **Confirmed**: blank → `false`, any `Yes` value → `true` (e.g. Adham Al Rabadi, Yr1) |
| `Gender` | `gender` | `M`/`F` → `Male`/`Female` |
| `Youth Comments` | `registration_comments` | |
| `Assigned Servant` | `assigned_servant_id` | Name lookup against provisioned servants (§3.5); ambiguous/zero matches → unmatched report |
| `Servant Comments` | `servant_comments` | Carried over as-is |
| `New Assisgnment` (sic) | `is_new_assignment` | **Confirmed**: `Yes` → `true`, blank → `false` (reversed from the draft's recommendation) |
| `Picture` | *deferred to the photo-migration pass* | |
| — | `group_id` | Fixed per source file (§3.1) |
| — | `legacy_source_ref` | `{spreadsheetId}:{tab}:{row}` |

### 3.7 `outreach_entries`

Unchanged from the draft: `Youth Name`/`Servant` resolved by lookup, `Date & Time` → `occurred_at`, `Type` (`Whattsapp` → `WhatsApp`), `Notes`, `Follow-up Due`, `Follow-up Dismissed` (still unconfirmed format — every sample was blank, treated as never-dismissed).

### 3.8 `attendance_records` — current year only in this pass

Unchanged: each cohort file's own Check-in responses tab, matched within that file's own roster. The weekly-grid and computed-roster tabs are formula-derived from this same log and correctly not imported.

### 3.9 `service_calendar_events`

Unchanged from the draft (§3.9 previously) — `Type` must match the app's fixed 6-value enum, anything else → unmatched report.

### 3.10 `audit_log` — now migrated and refreshed (new)

Real tab names confirmed: `SAY Ministry Audit - Calendar` → **Audit Log** (`Timestamp | User Email | User Name | Action Type | Year | Details`, 415 rows).

| Source | Destination |
|---|---|
| `Timestamp` | `occurred_at` |
| `User Email` | `user_id` — lookup against provisioned `profiles` (§3.5) |
| `Action Type` | `action_type` — mapped to the new enum, see table below |
| `Year` (`YEAR_1`..`YEAR_5`, or `-`) | `group_id` — lookup by `ladder_position`; `-`/blank → null |
| `Details` | `details` (jsonb) — imported as-is; shape is whatever the old app wrote, not reshaped to match new-app conventions |

**Action-type mapping** (all 14 old values map cleanly onto the new 24-value enum — 10 identical, 4 renamed for the app's "year"→"group"/"youth"→"member" terminology shift; the other 14 new enum values are new-app-only concepts with no old equivalent, so nothing maps *to* them from history):

| Old | New |
|---|---|
| `APP_ACCESS` | `APP_ACCESS` |
| `YEAR_SELECTED` | `GROUP_SELECTED` |
| `YOUTH_EDITED` | `MEMBER_EDITED` |
| `SERVANT_ASSIGNED` | `SERVANT_ASSIGNED` |
| `OUTREACH_ADDED` | `OUTREACH_ADDED` |
| `YOUTH_PHOTO_UPLOADED` | `MEMBER_PHOTO_UPLOADED` |
| `SERVANT_PROFILES_VIEWED` | `SERVANT_PROFILES_VIEWED` |
| `SERVANT_ATTENDANCE_VIEWED` | `SERVANT_ATTENDANCE_VIEWED` |
| `SERVANT_EDITED` | `SERVANT_EDITED` |
| `SERVANT_YEAR_UPDATED` | `SERVANT_GROUP_UPDATED` |
| `SERVANT_PHOTO_UPLOADED` | `SERVANT_PHOTO_UPLOADED` |
| `SERVANT_DELETED` | `SERVANT_DELETED` |
| `ADMIN_ACCESS_MAINTENANCE` | `ADMIN_ACCESS_MAINTENANCE` |
| `ADMIN_UNIVERSITIES_MAINTENANCE` | `ADMIN_UNIVERSITIES_MAINTENANCE` |

**Schema gap found**: unlike every other migrated table, `audit_log` currently has **no `legacy_source_ref` column at all** (it was never designed to be synced, per the original spec). Since it's now in scope for the wipe-and-reload, it needs one, the same way every other refreshed table has one. I'll include a new migration (`0034_audit_log_legacy_ref.sql`) adding it — **you'll need to run that one manually in the Supabase SQL editor, same as every other migration**, before the tool can refresh `audit_log` for the first time.

## 4. The "Data Refresh" wipe-and-reload

**Confirmed scope**: `members`, `attendance_records`, `outreach_entries`, `service_calendar_events`, `universities`, `verses`, and now `audit_log` (§3.10). **Not** `actions_needed_config` (§3.4, excluded entirely).

**Still not wiped, unchanged**: `auth.users`/`profiles`/`user_roles` (provisioning is its own idempotent step), `groups`/`qr_codes`/`app_settings` (no Sheets equivalent).

## 5. Data-quality issues found, and confirmed handling

- **Gender casing**: `M`/`F` (youth rosters) vs. `Male`/`Female`/mixed case (Servants roster, some form responses) — normalized to the app's `Male`/`Female` values regardless of source casing.
- **Role-string casing**: one `Coordinator` vs. the rest `coordinator` in Permissions — normalized to lowercase before mapping.
- **Yr1 roster's extra unnamed trailing column** — ignored.
- **Yr3's historical Attendance (Responses) `#REF!` row** — irrelevant, that whole tab isn't read from in this pass (§6).
- **Name-based matching is inherently fuzzy** — anything not resolving to exactly one match goes in the unmatched-rows report (§7), never guessed.

## 6. Historical attendance archives — deferred indefinitely

**Decided**: not part of this pass, and no committed timeline for a v2. If it happens later, you'll first build a cohort-to-cohort year-over-year mapping table yourself (since only you can correctly say "who was in Yr1 last year is now in Yr2 this year" for every individual) — I won't attempt that matching from the data alone. **The 5 standalone `SAY YrN Attendance (Responses)` files are not read from or touched at all in this pass** — nothing in v1 opens them.

## 7. Safety: the unmatched-rows report

Unchanged: any row that can't be confidently resolved — an Assigned Servant name matching zero or multiple people, an Outreach entry's Youth Name not found in that cohort's roster, a Calendar event Type not matching the fixed enum, a coordinator/servant with ambiguous Serving Year vs. Access Year columns — goes in a report, never force-matched.

## 8. Tool shape

Built (`migration/`, see its README for setup): standalone TypeScript script, target schema set via `MIGRATE_SCHEMA` in `.env` (not a CLI flag), run as `npm run migrate -- --dry-run` / `-- --run`. Supabase service-role key + Google service account for Sheets API read access. Dry-run produces the report without writing; `--run` is a separate, explicit step. Refuses to target `prod` unless `MIGRATE_CONFIRM_PROD=yes` is also set.

**Cutover (REQUIREMENTS.md §10.2) is Sheets → Prod directly, never Qa → Prod.** `qa` and `prod` are independent schemas (§1.1) -- running this tool against each is two entirely separate migrations from the same Sheets source, not a promotion of `qa`'s data into `prod`. The one cross-cutting detail: Supabase Auth accounts are shared project-wide, not schema-scoped, so a servant already provisioned during `qa` testing already has a real login account by the time the `prod` run happens -- the tool reuses it rather than erroring, and only adds the `prod`-schema `profiles`/`user_roles` rows.

---

## Still open

Only one thing left unresolved — everything else above is a confirmed decision, not a question:

- **§3.10's new migration** (`0034_audit_log_legacy_ref.sql`, adding `legacy_source_ref` to `audit_log`) needs to be written and run by you in the Supabase SQL editor before the tool's first `audit_log` refresh. I'll produce that file as part of building the tool, per the project's standing "migrations are never auto-applied" rule.

Otherwise: next step is building the actual script and running it in `--dry-run` mode against `qa`, and showing you that real report before anything is written for real. Say go whenever you're ready.

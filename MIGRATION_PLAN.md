# Data Migration Tool — Field Mapping & Design Report

**Status: DRAFT — nothing has been built or run. This is the report you asked to review before any migration executes.** Once you've read this and answered the open questions at the bottom, I'll build the tool per this design and show you a dry-run report (counts, samples, unmatched rows) before the first real write to any database.

---

## 1. Scope of this pass

Per your answers, this is being built in phases rather than one all-or-nothing tool:

- **This tool, v1**: everything below *except* photos and *except* the older (2024-25) historical attendance archives — see §6 for why the historical archives are proposed as a separate, optional v2 pass.
- **Separate, later**: photo migration (Drive → Supabase Storage) — your explicit request to not bundle it in.
- **Not migrated at all, by design**: the old sheet's own Audit Log tab. `audit_log` in the new app is native operational logging (REQUIREMENTS.md §10.1/§11), not a mirror of anything — the new app generates its own audit trail from real use going forward.

## 2. Source inventory (confirmed via direct inspection)

| File | Role |
|---|---|
| `25-26 SAY Yr0 Ministry` … `25-26 SAY Yr5+ Ministry` (6 files) | One per cohort/ladder-position: each has a **Roster** tab, an **Outreach** tab, a **Check-in responses** tab (current year), and a **Registration responses** tab (raw form log — not needed, Roster is the authoritative current state). |
| `25-26 SAY Servants Ministry` | Servants roster (no role/scope data — see §3.5). Has its own Check-in responses + Registration responses tabs (servant attendance). |
| `SAY Ministry Admin` | 5 tabs: **Access/Roles** (the real role+scope source), **Settings** (Outreach-Needed thresholds), **Action Types** (old audit enum — not migrated), **Universities**, **Verses**. |
| `SAY Ministry Audit - Calendar` | 2 tabs: **Audit Log** (not migrated, see above), **Calendar**. |
| `SAY YrN Attendance (Responses)` (5 files, one per year + Servants) | Legacy multi-tab workbooks holding **2024-25** history — proposed for a separate v2 pass (§6). |

## 3. Field mapping, by destination table

### 3.1 `groups` — no data migrated, resolved by lookup

Groups already exist in your live `qa`/`prod` database (created through the app's own Group Transition/admin tools, not seeded by migration file). The tool doesn't create or touch `groups` rows — it just needs to know, at run time, which `groups.id` corresponds to "Yr0 Ministry" through "Yr5+ Ministry": query `groups where ladder_position = 0`, `= 1`, … `>= 5` (terminal), for whichever schema (`qa`/`prod`) it's pointed at. If a position doesn't resolve to exactly one group, the tool stops and reports the problem rather than guessing.

### 3.2 `universities`

| Source (`SAY Ministry Admin` → Universities) | Destination |
|---|---|
| `University Name` | `name` |
| `Proximity` (`Local`/`Regional`/`Abroad`) | `proximity` |

44 real universities + 3 wildcard rows (`* Local University`, `* Regional University`, `* Abroad University`) that appear used directly as a member's university value in roster data (a catch-all for "somewhere local/regional/abroad, unknown which school"). These wildcards get migrated as real `universities` rows too, since roster rows reference them by exact name. **No `Unknown` proximity university exists in the source** — a member's proximity only becomes `Unknown` in the new app when `university_id` is null, i.e. **only from a roster row with a blank University column**, never from a source university row. Confirmed no separate "Unknown" university row to create.

### 3.3 `verses`

Single unnamed column, 26 quotes, no reference/attribution field. Migrates as `verses.text`, `reference` left null.

### 3.4 `actions_needed_config`

The Admin "Settings" tab's `Local/Regional/Abroad/Unknown - Minimum {Presence Count, Absence Weeks, Outreach Weeks}` rows map directly onto this table's existing per-proximity threshold rows (§3.10 of REQUIREMENTS.md). **The source only has 3 proximity categories with real values (Local/Regional/Abroad) — no `Unknown` row exists in the Settings tab**, even though the app's schema has one. Proposed: leave `Unknown`'s thresholds at whatever the app's own default/current value is, don't overwrite it from a nonexistent source row — flagged as open question 4 below.

### 3.5 Servant accounts + roles (`profiles` + `user_roles`) — pre-provisioned, no emails sent

Two source tabs have to be joined together — the Servants Ministry roster alone has no role or scope data:

| Field | Source |
|---|---|
| Identity match key | `SAY Ministry Admin` → Access/Roles, `Email` column (also present as `SAY Ministry Servants` → Roster `Email Address` — used to backfill phone/gender/Father of Confession, since Access/Roles doesn't carry those) |
| `full_name` | Access/Roles `Name` |
| `phone`, `father_of_confession`, `gender` | Servants Ministry Roster, matched by email (gender needs casing normalization — see §5) |
| `role` | Access/Roles `Role` (`admin`/`coordinator`/`servant` in source — see open question 1, no `sub_coordinator` string exists in source at all) |
| `group_id` scope | Access/Roles `Access Year 1`..`Access Year 5` — a `YES` in `Access Year N` becomes one `user_roles` row scoped to whichever `groups` row is currently at `ladder_position = N`. A person with multiple `YES` columns gets multiple `user_roles` rows (this is exactly the "exception grant" pattern REQUIREMENTS.md §4.2 already describes, so multiple rows per person is expected and correct, not an error). |

**Mechanics, since there's no "pending" account here (unlike self-registration)**: the tool creates a real `auth.users` row via Supabase's admin API (`auth.admin.createUser`, email pre-confirmed, no password set) for every servant/coordinator/admin found in Access/Roles, keyed by email. This does **not** send any email — only the separate "invite" and "password reset" API calls do that, and neither is used. It then inserts the matching `profiles` row and every `user_roles` grant. Idempotent: re-running finds the existing `auth.users` row by email and only updates `profiles`/adds-or-removes `user_roles` grants — it never deletes or recreates an existing account.

**One real assumption I want to test with a single account before trusting it for everyone**: when the actual person later signs in for real (Google OAuth, most likely, given the app's Google-as-default), Supabase needs to recognize their verified email and attach to this same pre-created account rather than creating a duplicate. This is Supabase's normal behavior for a verified/confirmed email, but I'd like to confirm it once for real before relying on it for ~60 people.

### 3.6 `members` (one Roster tab per cohort file → `members` rows scoped to that file's `group_id`)

| Source column | Destination field | Notes |
|---|---|---|
| `Full Name` | `full_name` | |
| `Phone Number` | `phone` | Normalized to `1 (416) 930-1659` format on import (REQUIREMENTS.md §10.1) |
| `Email Address` | `email` | |
| `University or College Name` | `university_id` | Looked up by exact name against `universities` (§3.2); blank → `university_id` null → proximity reads as `Unknown` |
| `Program of Study` | `program_of_study` | |
| `Date of Birth` | `date_of_birth` | |
| `Father of Confession` | `father_of_confession` | |
| `Home Address` | `home_address` | |
| `Visitor` | `is_visitor` | **Format unconfirmed — every sampled row was blank.** Proposed: blank → `false`, any non-blank value → `true`. Flagged as open question 2. |
| `Gender` | `gender` | `M`/`F` → `Male`/`Female` |
| `Youth Comments` | `registration_comments` | |
| `Assigned Servant` | `assigned_servant_id` | Name string, looked up against the pre-provisioned servant `profiles` (§3.5) by full name. **Collision risk if two servants share a name** — unmatched/ambiguous rows go in the report (§7), not silently guessed. |
| `Servant Comments` | `servant_comments` | Contains real freeform notes, including embedded parent phone numbers in some rows — carried over as-is, no special handling. |
| `New Assisgnment` (sic — real typo in source) | *not migrated* | This flag drives new-app behavior (surfacing on the Actions Needed board) tied to a "not yet followed up" lifecycle that a historical snapshot can't correctly represent — every migrated member starts with `is_new_assignment = false` regardless of this column's value. Flagged as open question 3 if you'd rather it were honored literally. |
| `Picture` | *deferred to the photo-migration pass* | |
| — | `group_id` | Fixed per source file (§3.1) |
| — | `legacy_source_ref` | Composed as `{spreadsheetId}:{tab}:{row}` |

### 3.7 `outreach_entries` (Outreach tab, per cohort file)

| Source | Destination | Notes |
|---|---|---|
| `Youth Name` | `member_id` | Looked up within that same file's own roster |
| `Servant` | `servant_id` | Looked up against provisioned servants (§3.5) |
| `Date & Time` | `occurred_at` | |
| `Type` (`Call`/`Text`/`Whattsapp`) | `type` | `Whattsapp` → `WhatsApp` (source typo, normalized) |
| `Notes` | `notes` | |
| `Follow-up Due` | `follow_up_due` | |
| `Follow-up Dismissed` | `follow_up_dismissed_at` | **Format unconfirmed — empty in every sampled row.** Treated as "never dismissed" (null) unless a populated example turns up. |

Row counts found: Yr0 has zero outreach history (brand new cohort) — expected, not a bug.

### 3.8 `attendance_records` — current year only in this pass

Source: each cohort file's own **Check-in responses** tab (`Timestamp | Select your name from the list`) → `attendee_type = 'member'`, matched within that file's own roster; the Servants Ministry file's equivalent tab → `attendee_type = 'servant'`. `service_date` = the date portion of `Timestamp`. This is the raw per-event log — the "weekly grid" and "computed roster with % Attendance/Status" tabs found in the same files are Sheets-formula-*derived* from this same raw log, not a separate source, and are correctly **not** imported (the new app computes those same numbers dynamically from `attendance_records`, same as it does for all new data going forward).

### 3.9 `service_calendar_events`

| Source (`SAY Ministry Audit - Calendar` → Calendar) | Destination |
|---|---|
| `Title` | `title` |
| `Description` | `description` |
| `Type` (`Holiday`, `Speaker Session` seen) | `event_type` — must match the app's fixed enum (Trip/Outing/Group Discussion/Speaker Session/Event/Holiday, REQUIREMENTS.md §6.8); anything not matching one of those six goes in the unmatched report rather than being dropped silently |
| `Start Date` / `End Date` | `start_date` / `end_date` |
| `Start Time` / `End Time` | `start_time` / `end_time` (null → `all_day = true`) |
| `Location` | `location` |
| `Attachment` | *deferred — empty in all samples, and this is Drive-hosted like photos* |
| `Created By` | Not a direct FK match (source likely holds a name/email, not a `profiles.id`) — resolved via the same servant/admin lookup as §3.5 |

## 4. The "Data Refresh" wipe-and-reload

Per your instruction: every run first clears, then reloads from Sheets. Scoped specifically to the **Sheets-sourced content** — `members`, `attendance_records`, `outreach_entries`, `service_calendar_events`, `universities`, `verses`, `actions_needed_config` — for whichever schema (`qa` or `prod`) the tool is pointed at.

**Explicitly NOT wiped by a refresh**, and I want to flag this clearly since getting it wrong would be destructive:
- `auth.users` / `profiles` / `user_roles` — real login accounts. Provisioning (§3.5) is its own idempotent step, re-run separately, never deletes an existing account.
- `groups`, `qr_codes`, `app_settings`, `audit_log` — no Sheets equivalent, untouched by any refresh, exactly as REQUIREMENTS.md §10.1 already specifies.

## 5. Data-quality issues found, and proposed handling

- **Gender casing inconsistency**: youth rosters use `M`/`F`; the Servants roster and some Admin-adjacent form responses use `Male`/`Female`/mixed case. Normalized to the app's `Male`/`Female` check-constraint values regardless of source casing.
- **Role-string casing**: Access/Roles has one row with `Coordinator` vs. the rest `coordinator`. Normalized to lowercase before mapping to the app's role enum.
- **No `sub_coordinator` in the source at all** — see open question 1.
- **Yr1 roster has an extra unnamed, empty trailing column** — ignored, not an error.
- **Yr3's historical Attendance (Responses) file has one `#REF!` broken-formula row** in a duplicate/backup tab — that whole tab is a formula-derived duplicate anyway (§3.8) and isn't read from, so this doesn't affect anything in this pass.
- **Name-based matching (servants, members, outreach) is inherently fuzzy** — anything that doesn't resolve to exactly one match becomes a line in the unmatched-rows report (§7), never a silent guess.

## 6. Proposed: defer the 2024-25 historical attendance archives to a v2 pass

The 5 standalone `SAY YrN Attendance (Responses)` files hold real, valuable history (weekly-grid attendance going back to Sept 2024), but importing them correctly is a meaningfully harder problem than everything above, for one reason: **the cohorts have since advanced**. "SAY Yr1 Attendance (Responses)" is last year's Yr1 roster — those specific people are now in this year's Yr2 (or wherever they landed), not this year's Yr1. Resolving "who is this historical check-in really for" means matching each historical name against the **current, full** roster across all six cohorts (not just one file's own roster, the way current-year data cleanly does), which is a real collision risk with youth-ministry-scale name overlap.

Proposed: ship v1 (current rosters, current-year attendance/outreach, servants/roles, config) first, confirm it's solid, then do the historical backfill as its own pass once the matching logic can be tested in isolation. This also means `join_date` will initially reflect only this year's earliest tracked date for people who don't yet have their older history imported — accurate but incomplete until the v2 pass runs, not wrong.

If you'd rather have both in one pass, say so and I'll fold it in — this is a recommendation, not something I've already decided.

## 7. Safety: the unmatched-rows report

Every row that can't be confidently resolved — an Assigned Servant name matching zero or multiple servants, an Outreach entry's Youth Name not found in that cohort's roster, a Calendar event's Type not matching the app's fixed enum — is written to a report, not guessed at or silently dropped. Nothing gets force-matched.

## 8. Tool shape

A standalone TypeScript script (`npm run migrate -- --schema=qa --dry-run` / `--schema=qa --run`), using a Supabase service-role key + a Google service account for Sheets API read access. Dry-run mode produces the counts/samples/unmatched-rows report without writing anything; `--run` is a second, explicit step. Never targets `prod` without saying so explicitly.

---

## Open questions — need your answer before I write any code

1. **Role mapping**: the source has exactly 3 role strings (`admin`, `coordinator`, `servant`) — no `sub_coordinator` anywhere. Since `coordinator` doesn't distinguish General vs. Sub- (REQUIREMENTS.md's two separate roles), how should every `coordinator` row map — all as `general_coordinator`, or do you know by name which ones are actually Sub-Coordinators and want to tell me?
2. **`Visitor` column format**: every sampled row was blank. Confirm blank → not-a-visitor, any non-blank value → visitor — or tell me what a "yes" actually looks like in a populated row.
3. **`New Assisgnment` column**: leave every migrated member as `is_new_assignment = false` (my recommendation, §3.6), or should a "yes" in the source set it `true`?
4. **`Unknown` proximity threshold**: the source Settings tab has no `Unknown` row. Leave the app's existing/default `Unknown` threshold untouched (my recommendation), or should it get a specific value?
5. **Historical attendance (§6)**: defer the 2024-25 archives to a v2 pass (my recommendation), or fold them into v1 despite the added matching risk?
6. **Confirm the wipe-and-reload scope (§4)** is what you meant — Sheets-sourced content only, not login accounts.

# SAY Migration Tool

Standalone script -- reads the legacy Google Sheets app, writes into the new app's Supabase schema. Never deployed, never runs inside the app itself. See `../MIGRATION_PLAN.md` for the full design (every field mapping, every data-quality decision) -- this file is just setup + how to run it.

## One-time setup

### 1. Install

```bash
cd migration
npm install
cp .env.example .env
```

### 2. Google service account (read-only Sheets access)

The tool reads via the Sheets API, not your own Google login -- it needs its own credentials.

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project (or reuse one you already have).
2. **APIs & Services → Library** → search "Google Sheets API" → Enable.
3. **APIs & Services → Credentials** → Create Credentials → Service Account. Any name (e.g. "say-migration-reader"). No roles needed at the project level -- access is granted per-sheet in step 5.
4. Open the new service account → **Keys** → Add Key → Create new key → JSON. This downloads a `.json` file.
5. Move that file into `migration/service-account.json` (the default path `.env.example` points at -- already gitignored, never gets committed).
6. Open the downloaded JSON, find the `client_email` field (looks like `say-migration-reader@your-project.iam.gserviceaccount.com`).
7. **Share every source spreadsheet with that email, Viewer access is enough** -- the 6 cohort files, Servants Ministry, Admin, and the Audit-Calendar file (see `../MIGRATION_PLAN.md` §2 for the full list). Ten files, ten "Share" clicks.

### 3. Supabase service role key

Supabase dashboard → your project → **Project Settings → API** → copy the `service_role` key (not `anon`) into `.env` as `SUPABASE_SERVICE_ROLE_KEY`, and the project URL as `SUPABASE_URL`.

### 4. Run migration 0034 first

`audit_log` needs a new column before this tool can touch it. Run `../supabase/migrations/0034_audit_log_legacy_ref.sql` in the Supabase SQL editor, prefixed with `set search_path to qa;` (or `prod;`), same as every other migration in this project -- **not automatic, do this by hand.**

## Running it

Always start with a dry run:

```bash
npm run migrate -- --dry-run
```

Prints exactly what it would do -- row counts per table, and every row it couldn't confidently resolve (an unrecognized name, a missing university, a role that doesn't fit the mapping) -- without writing anything to the database. Review that output. Fix anything in the source sheets if needed, and re-run the dry run until it looks right.

When it looks right:

```bash
npm run migrate -- --run
```

This is the "Data Refresh" from `../MIGRATION_PLAN.md` §4 -- it clears `members`, `attendance_records`, `outreach_entries`, `service_calendar_events`, `universities`, `verses`, and `audit_log`, then reloads all of them fresh from Sheets. It does **not** touch `actions_needed_config`, login accounts, `groups`, `qr_codes`, or `app_settings`.

`MIGRATE_SCHEMA` in `.env` controls whether this targets `qa` or `prod`. Targeting `prod` additionally requires `MIGRATE_CONFIRM_PROD=yes` in `.env` -- the tool refuses to run against `prod` without it, on purpose.

## What this doesn't do (by design)

- **Photos** -- deferred to a separate pass, not built yet.
- **2024-25 historical attendance** (the standalone `SAY YrN Attendance (Responses)` files) -- deferred indefinitely, not touched at all. See `../MIGRATION_PLAN.md` §6.
- **`actions_needed_config`** -- excluded entirely, in both directions. Already configured directly in the app.

## If a tab name lookup fails

`src/sheetIds.ts`'s `TABS` object names were confirmed by directly exporting the Admin file and reading its real sheet names (`Permissions`, `Universities`, `Verses`), but the cohort/Servants/Calendar file tab names (`Roster`, `Outreach`, `Check-in responses`, `Calendar`, `Audit Log`) come from an earlier natural-language content inspection that couldn't see real tab names directly -- see `../MIGRATION_PLAN.md` §2's tool-limitation note. If the Sheets API errors with something like "Unable to parse range" for a specific file, open that file's tab bar in the browser, find its actual tab name, and fix the corresponding entry in `src/sheetIds.ts`.

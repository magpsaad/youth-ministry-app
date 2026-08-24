# Database migrations

Plain SQL migrations translating `DATABASE_SCHEMA.md` into runnable DDL, meant to be applied via the Supabase SQL Editor (or `psql`) **twice** — once per environment schema — per `REQUIREMENTS.md` §1.1's single-project, two-schema plan.

## Why two schemas instead of two projects

Supabase's free tier caps an account at 2 active projects total. Since the project owner already has one unrelated active project, only one more free project slot exists — so Production and QA live in **one Supabase project**, as **two separate Postgres schemas** (`prod` and `qa`), each holding a full, independent copy of every table. See `REQUIREMENTS.md` §1.1 for the full reasoning and trade-offs.

## How to apply these migrations

The SQL files are schema-agnostic on purpose — no table is written as `prod.members` or `qa.members`. Instead, run the exact same set of files twice, once with each schema set as the target via `search_path`, so the unqualified `create table members (...)` lands wherever `search_path` points.

For each environment (`qa` first, then `prod` once verified):

1. In the Supabase SQL Editor, create the schema if it doesn't exist yet:
   ```sql
   create schema if not exists qa;   -- or: create schema if not exists prod;
   ```
2. Point new objects at that schema for this session:
   ```sql
   set search_path to qa;   -- or: set search_path to prod;
   ```
3. Run each file in this folder **in order** (`0001_...` through `0008_...`), pasting its contents into the SQL Editor and executing it.
4. In **Project Settings → Data API** (a separate tab from "API Keys"), find **Exposed schemas** under Settings, and add `qa` (and later `prod`) to the list of schemas PostgREST is allowed to serve — `public` is exposed by default, but a custom schema is not, and the app's Supabase client won't be able to reach it until this is done.
5. In the app's `.env.local` (see `web/.env.local.example`), set `NEXT_PUBLIC_APP_ENV=qa` (or `prod`) so the app talks to the matching schema.

## File order and contents

| File | Contents |
|---|---|
| `0001_extensions_and_types.sql` | pgcrypto extension, all enum types, the generic `set_updated_at()` trigger function |
| `0002_core_tables.sql` | `app_settings`, `universities`, `groups`, `profiles` (+ the auth.users signup trigger), `members` |
| `0003_roles_and_access.sql` | `user_roles`, and the `is_admin` / `has_group_access` / etc. helper functions every RLS policy relies on |
| `0004_operational_tables.sql` | `attendance_records`, `outreach_entries`, `service_calendar_events` |
| `0005_config_tables.sql` | `actions_needed_config`, `audit_config`, `audit_log`, `qr_codes`, `verses` |
| `0006_functions.sql` | `run_group_transition()`, and the public no-login QR check-in/intake RPC functions |
| `0007_rls_policies.sql` | Row-Level Security policies for every table |
| `0008_grants.sql` | Table/schema-level GRANTs `anon`/`authenticated` need in addition to RLS |

## A note on the public QR check-in RPC functions (0006)

`DATABASE_SCHEMA.md`'s original RLS sketch only covered *authenticated* access to tables directly. The public check-in/intake pages (`REQUIREMENTS.md` §6.11) have no login at all, so they can't go through table-level RLS as a signed-in user. `checkin_list_members`, `checkin_mark_attendance`, and `checkin_submit_new_member` are the sanctioned side door: narrow, `security definer` functions that validate a QR code's token internally and expose only what that specific flow needs, granted to the `anon` role. This pattern will be extended in Phase C (Attendance + QR pipeline) to cover the Servants QR self-check-in flow too, which isn't built out yet — these three functions currently only handle member check-in/intake.

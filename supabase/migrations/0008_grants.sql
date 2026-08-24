-- 0008_grants.sql
-- RLS policies (0007) only filter rows — Postgres also requires the underlying
-- table-level GRANTs before `anon`/`authenticated` can touch a table at all.
-- Run this last, against the same schema (via search_path) as everything else.

grant usage on schema public to anon, authenticated;
-- If this migration is applied to a non-public schema (see supabase/README.md
-- for the prod/qa approach), replace `public` above with that schema's name,
-- or run: grant usage on schema <schema_name> to anon, authenticated;

-- authenticated: broad table access, RLS policies (0007) do the real gating.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- anon: only what the public, no-login QR check-in/intake pages need directly.
-- (The check-in flow itself goes through the security-definer RPC functions in
-- 0006_functions.sql, which already have their own explicit EXECUTE grants to
-- anon and don't need table-level grants at all.)
grant select on app_settings to anon;
grant select on universities to anon;

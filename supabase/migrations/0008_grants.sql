-- 0008_grants.sql
-- RLS policies (0007) only filter rows — Postgres also requires the underlying
-- table-level GRANTs before `anon`/`authenticated` can touch a table at all.
-- Run this last, against the same schema (via search_path) as everything else.

-- `grant ... on schema <name>` and `grant ... on all tables/sequences in schema
-- <name>` require a literal schema name -- unlike ordinary unqualified table
-- references elsewhere in these files, they do NOT follow search_path. Using
-- current_schema() here (which DOES reflect the search_path set before running
-- this file) keeps this genuinely reusable for qa now and prod later, with no
-- manual edits needed each time.
do $$
begin
  execute format('grant usage on schema %I to anon, authenticated', current_schema());
  execute format('grant select, insert, update, delete on all tables in schema %I to authenticated', current_schema());
  execute format('grant usage, select on all sequences in schema %I to authenticated', current_schema());
end
$$;

-- anon: only what the public, no-login QR check-in/intake pages need directly.
-- (The check-in flow itself goes through the security-definer RPC functions in
-- 0006_functions.sql, which already have their own explicit EXECUTE grants to
-- anon and don't need table-level grants at all.)
grant select on app_settings to anon;
grant select on universities to anon;

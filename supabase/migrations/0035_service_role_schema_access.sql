-- 0035_service_role_schema_access.sql
-- 0008_grants.sql granted schema/table access to anon and authenticated --
-- the only roles the app itself ever connects as (through PostgREST + a
-- signed-in user's session, filtered by RLS). It never granted anything to
-- service_role, because until the migration tool (migration/), nothing in
-- this project ever connected directly as service_role. Postgres requires
-- an explicit schema-level GRANT USAGE before service_role can even see a
-- non-public schema at all -- RLS-bypass privilege doesn't substitute for
-- it. Same current_schema()-based pattern as 0008 so this is reusable
-- as-is for qa now and prod later, no manual edits needed.

do $$
begin
  execute format('grant usage on schema %I to service_role', current_schema());
  execute format('grant all privileges on all tables in schema %I to service_role', current_schema());
  execute format('grant usage, select on all sequences in schema %I to service_role', current_schema());
end
$$;

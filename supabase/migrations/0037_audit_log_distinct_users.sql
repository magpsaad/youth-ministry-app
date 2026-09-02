-- 0037_audit_log_distinct_users.sql
-- REQUIREMENTS.md §3.11/§6.14 -- owner-reported: the User dropdown on both
-- Audit Logs and Audit Report only showed 3 names, even though far more
-- servants have real log entries. Root cause: both actions.ts files fetched
-- every `audit_log` row (user_id, profiles(full_name)) with no `.order()`
-- and no `.limit()`, then de-duplicated client-side -- but an unbounded
-- PostgREST query is still capped at the project's default row limit
-- (1000), returned in whatever order Postgres happens to produce for an
-- unordered query. With thousands of historical rows migrated in roughly
-- chronological order, that cap was silently landing mid-way through the
-- earliest period of activity, when only a handful of people had any
-- logged actions yet -- so only their names ever made it into the capped
-- result set, no matter how many other servants have entries today.
--
-- A real SELECT DISTINCT, computed in Postgres, has no such cap regardless
-- of how large audit_log grows (it's still-growing, append-only, by
-- design -- REQUIREMENTS.md §3.11).

create or replace function get_audit_log_users()
returns table (user_id uuid, full_name text)
language sql
stable
security definer
as $$
  select distinct p.id, p.full_name
  from audit_log a
  join profiles p on p.id = a.user_id
  where a.user_id is not null;
$$;

grant execute on function get_audit_log_users() to authenticated;

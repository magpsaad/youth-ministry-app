-- 0057_fix_read_only_write_regression.sql
-- Owner-reported: a Read-Only servant could actually edit a youth record --
-- confirmed live (a real UPDATE against qa succeeded and persisted for a
-- throwaway read_only account).
--
-- Root cause: migration 0024 redefined has_group_access() to explicitly
-- EXCLUDE 'read_only' role rows, since it's reused by every WRITE policy
-- (members_update/insert/delete, outreach, attendance) as well as reads.
-- Migration 0043 (an unrelated fix, for photo uploads failing under RLS)
-- then did `create or replace function has_group_access(...)` again to
-- fully schema-qualify its body -- but its copy of the function body
-- predated 0024's fix and had no read_only exclusion at all, so applying
-- 0043 silently reverted 0024's security fix the moment it ran. Neither
-- migration's own review caught the collision since they touch the same
-- function for two unrelated reasons.
--
-- This restores 0024's exclusion while keeping 0043's schema-qualification
-- (both are correct and don't conflict -- 0043 just needs 0024's body).

do $$
declare
  v_schema text := current_schema();
begin
  execute format($outer$
    create or replace function %1$I.has_group_access(gid uuid, uid uuid default auth.uid())
    returns boolean language sql stable security definer set search_path = %1$I, public as $fn$
      select %1$I.is_admin_or_general_coordinator(uid)
        or exists (
          select 1 from %1$I.user_roles
          where user_id = uid and group_id = gid and role != 'read_only'
        );
    $fn$;
  $outer$, v_schema);
end
$$;

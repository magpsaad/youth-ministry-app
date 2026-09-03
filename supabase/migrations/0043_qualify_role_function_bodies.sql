-- 0043_qualify_role_function_bodies.sql
-- Owner-reported: photo upload still fails with "new row violates row-level
-- security policy" even after 0012 (schema-qualified the storage policies'
-- *call site*, qa.is_app_user()) and 0013 (pinned each function's own
-- search_path via ALTER FUNCTION ... SET search_path) were both re-applied.
-- Directly reproduced against qa (a real throwaway servant account, signed
-- in via the anon key, running the exact storage.upload() the app itself
-- performs) -- still fails identically after both of those fixes.
--
-- This removes the dependency on search_path entirely rather than trying a
-- third variant of relying on it: every table/function reference inside
-- these RLS helper functions' own SQL bodies is now fully schema-qualified
-- as literal text (current_schema(), captured while this migration itself
-- runs with the right schema on the search path -- same v_schema pattern
-- 0009/0010/0012/0013 already use), so their behavior can no longer depend
-- on search_path or Postgres's function-inlining behavior at all, no matter
-- which context calls them (PostgREST, Storage, or anything else).
--
-- Also re-applies 0013's `set search_path` on the function itself, kept as
-- a second, redundant layer of protection -- harmless, and correct standard
-- practice for any SECURITY DEFINER function regardless of this bug.

do $$
declare
  v_schema text := current_schema();
begin
  execute format($outer$
    create or replace function %1$I.is_admin_or_general_coordinator(uid uuid default auth.uid())
    returns boolean language sql stable security definer set search_path = %1$I, public as $fn$
      select exists (
        select 1 from %1$I.user_roles
        where user_id = uid and role in ('admin', 'general_coordinator')
      );
    $fn$;
  $outer$, v_schema);

  execute format($outer$
    create or replace function %1$I.is_admin(uid uuid default auth.uid())
    returns boolean language sql stable security definer set search_path = %1$I, public as $fn$
      select exists (select 1 from %1$I.user_roles where user_id = uid and role = 'admin');
    $fn$;
  $outer$, v_schema);

  execute format($outer$
    create or replace function %1$I.has_group_access(gid uuid, uid uuid default auth.uid())
    returns boolean language sql stable security definer set search_path = %1$I, public as $fn$
      select %1$I.is_admin_or_general_coordinator(uid)
        or exists (
          select 1 from %1$I.user_roles
          where user_id = uid and group_id = gid
        );
    $fn$;
  $outer$, v_schema);

  execute format($outer$
    create or replace function %1$I.can_manage_servants(uid uuid default auth.uid())
    returns boolean language sql stable security definer set search_path = %1$I, public as $fn$
      select %1$I.is_admin_or_general_coordinator(uid);
    $fn$;
  $outer$, v_schema);

  execute format($outer$
    create or replace function %1$I.is_app_user(uid uuid default auth.uid())
    returns boolean language sql stable security definer set search_path = %1$I, public as $fn$
      select exists (select 1 from %1$I.user_roles where user_id = uid);
    $fn$;
  $outer$, v_schema);
end
$$;

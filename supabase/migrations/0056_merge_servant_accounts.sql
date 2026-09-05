-- 0056_merge_servant_accounts.sql
-- Owner-requested: a servant who signs in with a different email ends up
-- with two separate accounts (two `profiles` rows). Unlike
-- remove_profile_completely() (migration 0051), which refuses to run if the
-- account being removed has any real history, this is for the opposite
-- case -- BOTH accounts may have real, distinct history, and the owner
-- explicitly wants neither side's history lost: pick which account to
-- keep, and fold the other one's history into it.
--
-- Re-parents every table that references profiles(id) with real history
-- (the exact same list remove_profile_completely() already enumerates:
-- attendance_records, outreach_entries, service_calendar_events,
-- pending_servants, holiday_rules, user_roles, audit_log), plus the
-- member-assignment caseload (members.assigned_servant_id), from the
-- account being removed onto the account being kept. Two places need
-- collision handling rather than a plain re-parent:
--   * attendance_records has `unique (servant_id, service_date)` -- if both
--     accounts were (for whatever reason) marked present the same day, the
--     kept account's own row wins and the duplicate is simply dropped (the
--     person only attended once that day; nothing distinct is lost).
--   * user_roles has `unique (user_id, role, group_id)` -- if both accounts
--     hold the exact same role+group, the duplicate is dropped; a role held
--     at a DIFFERENT group is kept (a person legitimately serving two
--     cohorts under their two former accounts should still serve both).
-- join_date (migration 0026, "only ever moves earlier") is recomputed as
-- the earlier of the two accounts' own join_date, since the trigger that
-- normally maintains it only fires on INSERT, not on this kind of re-parent.
--
-- Deliberately does NOT touch the underlying auth.users row, same
-- limitation and same reason as remove_profile_completely(): that needs the
-- Supabase Admin API (service-role key), which this app's normal
-- server-side client doesn't have. The removed account's login email stays
-- technically able to sign in; doing so will just lazily provision a fresh,
-- empty profile (lib/supabase/ensure-profile.ts), same as any first-time
-- sign-in -- it will NOT resurrect the merged-away history.

create or replace function merge_servant_accounts(p_keep_id uuid, p_remove_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_keep_join date;
  v_remove_join date;
begin
  if not is_admin() then
    raise exception 'Only System Admins can merge accounts';
  end if;

  if p_keep_id = p_remove_id then
    raise exception 'Cannot merge an account into itself';
  end if;

  if not exists (select 1 from profiles where id = p_keep_id) then
    raise exception 'The account to keep was not found';
  end if;
  if not exists (select 1 from profiles where id = p_remove_id) then
    raise exception 'The account to merge away was not found';
  end if;

  -- Attendance: drop the duplicate's row for any date the kept account
  -- already has, then re-parent everything left.
  delete from attendance_records ar
  where ar.servant_id = p_remove_id
    and exists (
      select 1 from attendance_records keep_ar
      where keep_ar.servant_id = p_keep_id and keep_ar.service_date = ar.service_date
    );
  update attendance_records set servant_id = p_keep_id where servant_id = p_remove_id;

  update outreach_entries set servant_id = p_keep_id where servant_id = p_remove_id;
  update service_calendar_events set created_by = p_keep_id where created_by = p_remove_id;
  update pending_servants set approved_by = p_keep_id where approved_by = p_remove_id;
  update pending_servants set resulting_profile_id = p_keep_id where resulting_profile_id = p_remove_id;
  update holiday_rules set created_by = p_keep_id where created_by = p_remove_id;
  update audit_log set user_id = p_keep_id where user_id = p_remove_id;

  -- Current caseload -- the duplicate's assigned youths move to the kept account.
  update members set assigned_servant_id = p_keep_id where assigned_servant_id = p_remove_id;

  -- Roles: drop any exact (role, group) duplicate, re-parent the rest.
  delete from user_roles ur
  where ur.user_id = p_remove_id
    and exists (
      select 1 from user_roles keep_ur
      where keep_ur.user_id = p_keep_id
        and keep_ur.role = ur.role
        and keep_ur.group_id is not distinct from ur.group_id
    );
  update user_roles set user_id = p_keep_id where user_id = p_remove_id;

  select join_date into v_keep_join from profiles where id = p_keep_id;
  select join_date into v_remove_join from profiles where id = p_remove_id;
  update profiles set join_date = least(v_keep_join, v_remove_join) where id = p_keep_id;

  delete from profiles where id = p_remove_id;
end;
$$;

revoke all on function merge_servant_accounts(uuid, uuid) from public;
grant execute on function merge_servant_accounts(uuid, uuid) to authenticated;

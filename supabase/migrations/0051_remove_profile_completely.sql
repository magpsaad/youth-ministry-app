-- 0051_remove_profile_completely.sql
-- Owner-reported: a servant signed in with two different email addresses,
-- creating two separate accounts. The owner removed the unwanted one from
-- Servant Profiles ("Remove Servant"), but that action (remove_servant(),
-- migration 0022) only ever deleted the 'servant' role grant -- the
-- underlying `profiles` row itself was left behind. With no role left, it
-- vanishes from every role-filtered screen (Servant Directory, Servant
-- Profiles, etc.), but Access Maintenance lists every profile regardless of
-- role, so the orphaned record kept showing up there with no way to act on
-- it.
--
-- remove_profile_completely() is a real, full delete of the profiles row
-- (cascading its user_roles grants, if any are still held) -- but refuses
-- to run if the person has left behind any REAL history (attendance they
-- took, outreach they logged, a calendar event they created, a pending-
-- servant record they touched, a holiday rule they added), so this can
-- never be used to silently destroy someone's genuine activity. audit_log
-- rows are the one exception -- cleared as part of the removal rather than
-- treated as a blocker, since something as routine as "signed in" isn't
-- meaningful history worth keeping for an account that's being deleted
-- outright (same call made for throwaway/duplicate accounts elsewhere in
-- this project).
--
-- Deliberately does NOT touch the underlying auth.users row (that needs
-- the Supabase Admin API, which requires the service-role key -- not
-- something this app's normal server-side client has, or should be given
-- lightly). The email becomes free to sign in again ONLY functionally --
-- a fresh sign-in with the same email re-provisions a brand-new profiles
-- row against the still-existing auth.users account, same as any other
-- first-time sign-in.

create or replace function remove_profile_completely(p_profile_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_blockers text[] := array[]::text[];
  v_count int;
begin
  if not is_admin() then
    raise exception 'Only System Admins can remove a person''s record';
  end if;

  if not exists (select 1 from profiles where id = p_profile_id) then
    raise exception 'Person not found';
  end if;

  select count(*) into v_count from attendance_records where servant_id = p_profile_id;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, v_count || ' attendance record(s)');
  end if;

  select count(*) into v_count from outreach_entries where servant_id = p_profile_id;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, v_count || ' outreach entr' || (case when v_count = 1 then 'y' else 'ies' end));
  end if;

  select count(*) into v_count from service_calendar_events where created_by = p_profile_id;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, v_count || ' calendar event(s) created');
  end if;

  select count(*) into v_count from pending_servants
    where approved_by = p_profile_id or resulting_profile_id = p_profile_id;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, v_count || ' pending-servant record(s) linked');
  end if;

  select count(*) into v_count from holiday_rules where created_by = p_profile_id;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, v_count || ' holiday rule(s) created');
  end if;

  if array_length(v_blockers, 1) > 0 then
    raise exception 'Cannot remove -- this person has real history: %', array_to_string(v_blockers, ', ');
  end if;

  -- Same defensive clear remove_servant() already does -- harmless no-op if
  -- they were never assigned any members.
  update members set assigned_servant_id = null, is_new_assignment = false where assigned_servant_id = p_profile_id;

  delete from audit_log where user_id = p_profile_id;
  delete from profiles where id = p_profile_id;
end;
$$;

revoke all on function remove_profile_completely(uuid) from public;
grant execute on function remove_profile_completely(uuid) to authenticated;

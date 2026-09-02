-- 0041_dont_regrant_unassigned_servant_if_already_serving.sql
-- Owner-reported, exceptional workflow: a new servant signed in directly,
-- submitted their info via /register (creating a pending_servants row),
-- and the Admin granted them Servant-at-Yr2 directly through Access
-- Maintenance rather than approving that pending row. The pending row got
-- approved too (separately) and later linked -- link_approved_pending_
-- servant() unconditionally does
--   insert into user_roles (user_id, role, group_id) values (v_uid, 'servant', null)
-- with no check for whether this person already holds a real Servant grant
-- from somewhere else. Result: TWO 'servant' rows -- one at Yr2 (correct),
-- one Unassigned (spurious) -- and every screen that groups by role/group
-- (Servant Profiles, Servant Assignments) correctly listed them under BOTH,
-- reading as "still Unassigned" even though the real Yr2 grant was there
-- too. Confirmed directly against real data: exactly this shape, for
-- "Magnous REI".
--
-- Fix: only grant the base Unassigned servant role if this person doesn't
-- already hold ANY 'servant' role (assigned to some cohort or otherwise) --
-- the whole point of that unconditional grant was "make sure a linked
-- registrant has at least baseline servant access," which a real cohort
-- assignment already satisfies.

create or replace function link_approved_pending_servant(p_email text)
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_pending record;
begin
  if v_uid is null then
    return;
  end if;

  select id, phone, father_of_confession, gender
  into v_pending
  from pending_servants
  where approved_at is not null
    and resulting_profile_id is null
    and (submitted_by_profile_id = v_uid or (p_email is not null and lower(email) = lower(p_email)))
  order by (submitted_by_profile_id = v_uid) desc, submitted_at asc
  limit 1;

  if v_pending.id is null then
    return;
  end if;

  if not exists (select 1 from user_roles where user_id = v_uid and role = 'servant') then
    insert into user_roles (user_id, role, group_id) values (v_uid, 'servant', null);
  end if;

  update profiles
  set phone = coalesce(profiles.phone, v_pending.phone),
      father_of_confession = coalesce(profiles.father_of_confession, v_pending.father_of_confession),
      gender = coalesce(profiles.gender, v_pending.gender)
  where id = v_uid;

  insert into attendance_records (attendee_type, servant_id, service_date)
  select 'servant', v_uid, psa.service_date
  from pending_servant_attendance psa
  where psa.pending_servant_id = v_pending.id
  on conflict (servant_id, service_date) do nothing;

  update pending_servants set resulting_profile_id = v_uid where id = v_pending.id;
end;
$$;

-- 0042_absorb_own_pending_registration.sql
-- Owner-reported, exceptional workflow: a new servant signs in directly,
-- fills in the /register form (creating a pending_servants row via
-- submit_own_servant_registration() -- their phone/gender only live on
-- THAT row at this point, not yet on profiles). If an Admin then grants
-- them access directly through Access Maintenance instead of formally
-- approving the pending row through the Pending Servants screen,
-- link_approved_pending_servant() never runs meaningfully (its query
-- requires approved_at is not null, which this path never sets) -- so the
-- phone/gender they already typed never gets copied onto their real
-- profile. The person now has a role, but /register still finds
-- phone/gender null and asks them to fill in the exact same two fields
-- again.
--
-- Fix: a self-heal step, called from /register (web/src/app/register/
-- page.tsx) every time it loads. If the signed-in caller already holds a
-- role (granted some other way) and has a still-unlinked registration of
-- their own sitting around, absorb it -- copy whatever fields are still
-- blank, and close the pending row out (marking it approved too, if it
-- somehow wasn't, so it stops sitting in the Pending Servants queue
-- looking unreviewed when the person clearly already has access).

create or replace function absorb_own_pending_registration()
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

  -- Only meaningful once they already hold a role -- otherwise the normal
  -- approve-then-link flow (link_approved_pending_servant) is still the
  -- real gate, and this would grant nothing on its own regardless.
  if not exists (select 1 from user_roles where user_id = v_uid) then
    return;
  end if;

  select id, phone, father_of_confession, gender
  into v_pending
  from pending_servants
  where submitted_by_profile_id = v_uid and resulting_profile_id is null
  order by submitted_at desc
  limit 1;

  if v_pending.id is null then
    return;
  end if;

  update profiles
  set phone = coalesce(profiles.phone, v_pending.phone),
      father_of_confession = coalesce(profiles.father_of_confession, v_pending.father_of_confession),
      gender = coalesce(profiles.gender, v_pending.gender)
  where id = v_uid;

  update pending_servants
  set resulting_profile_id = v_uid,
      approved_at = coalesce(approved_at, now())
  where id = v_pending.id;
end;
$$;

revoke all on function absorb_own_pending_registration() from public;
grant execute on function absorb_own_pending_registration() to authenticated;

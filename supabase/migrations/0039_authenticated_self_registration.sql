-- 0039_authenticated_self_registration.sql
-- REQUIREMENTS.md §6.1 addendum -- the "exceptional workflow": a new
-- servant who signs into the app directly, without first using the
-- Checkin QR/link, gets a bare profile with no phone/gender and no role.
-- Owner-agreed design (extensive discussion this session):
--   - No one gets in without either (a) the existing anonymous Checkin +
--     approval flow, or (b) a deliberate Admin action (Access Maintenance,
--     or the one-time SQL admin bootstrap) -- covered already, untouched.
--   - A signed-in person with no role/registration yet is pointed at a
--     plain link (not a QR code -- they may only have the one phone) to
--     an authenticated version of the same registration step, which still
--     requires the same Admin/GC approval before granting anything (owner:
--     "otherwise there could be a loophole where someone could sign in
--     first then go through checkin without ever being noticed").
--   - Someone who already HAS a role (granted directly, bypassing Checkin
--     entirely) but is missing phone/gender fills in the same fields
--     directly onto their own profile, no second approval needed -- a
--     human already decided to grant them access.
--   - No new "is this profile exempt" column needed: every currently-
--     migrated servant already has phone+gender filled in (verified
--     directly against real data, one gap fixed by the owner), so the
--     gate is simply "does this profile have phone and gender" -- no
--     grandfathering required.

-- Ties an authenticated submission directly to the real profile it came
-- from -- fully reliable, no email-matching/typo risk for this path (the
-- existing anonymous Checkin flow still relies on email matching, since
-- there's no signed-in identity to tie to at that point).
alter table pending_servants add column if not exists submitted_by_profile_id uuid references profiles(id);

-- The /register page needs to tell "awaiting approval" apart from "never
-- submitted" for the person who submitted it -- pending_servants_select
-- was Admin/GC-only (0014), which would silently hide someone's own
-- not-yet-approved row from themselves. Widened, not narrowed: still
-- everyone's rows for Admin/GC, plus now your own.
drop policy pending_servants_select on pending_servants;
create policy pending_servants_select on pending_servants for select
  using (is_admin_or_general_coordinator() or submitted_by_profile_id = auth.uid());

-- ── submit_own_servant_registration ─────────────────────────────────────
-- The authenticated counterpart to checkin_submit_new_servant(): the
-- caller is already known (auth.uid()), so full_name/email come from their
-- real profile, not user-typed input. Still only ever produces a row an
-- Admin/GC must approve (pending_servants_select/update stay
-- is_admin_or_general_coordinator()-gated, untouched) -- filling this form
-- out never grants access by itself. Resubmitting (e.g. fixing a typo)
-- updates the same still-unlinked row rather than piling up duplicates.
create or replace function submit_own_servant_registration(
  p_phone text,
  p_gender text,
  p_father_of_confession text default null,
  p_comments text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_pending_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select email, full_name into v_email, v_full_name from profiles where id = v_uid;
  if v_full_name is null then
    raise exception 'Profile not found';
  end if;

  update pending_servants
  set phone = p_phone, gender = p_gender, father_of_confession = p_father_of_confession,
      registration_comments = p_comments
  where submitted_by_profile_id = v_uid and resulting_profile_id is null
  returning id into v_pending_id;

  if v_pending_id is null then
    insert into pending_servants (full_name, phone, email, father_of_confession, gender, registration_comments, submitted_by_profile_id)
    values (v_full_name, p_phone, v_email, p_father_of_confession, p_gender, p_comments, v_uid)
    returning id into v_pending_id;
  end if;

  return v_pending_id;
end;
$$;

revoke all on function submit_own_servant_registration(text, text, text, text) from public;
grant execute on function submit_own_servant_registration(text, text, text, text) to authenticated;

-- ── link_approved_pending_servant, extended ─────────────────────────────
-- Now prefers matching by submitted_by_profile_id (set above) over email
-- matching when both could apply -- fully deterministic, no ambiguity.
-- The anonymous Checkin path (submitted_by_profile_id is null) keeps
-- working exactly as before, matched by email only.
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

  insert into user_roles (user_id, role, group_id) values (v_uid, 'servant', null)
  on conflict (user_id, role, group_id) do nothing;

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

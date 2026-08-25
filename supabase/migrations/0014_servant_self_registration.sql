-- 0014_servant_self_registration.sql
-- Phase C: servant self-check-in/registration via the "Servants" QR code
-- (group_id is null in qr_codes), mirroring the member check-in/intake flow
-- but WITHOUT creating an app account at registration time -- a servant is
-- always a real Supabase Auth account (profiles.id references auth.users),
-- and a public no-login page has no account to attach one to yet.
--
-- Design: self-registration writes to a staging table (pending_servants),
-- not profiles/user_roles. An Admin/General Coordinator later marks a
-- pending row "approved". Whenever that real person eventually signs into
-- the app themselves (normal Google/email login, no special invite link),
-- ensure-profile.ts links their new profile to the matching approved
-- pending row by email, creates their servant role (unassigned -- see
-- below), copies their submitted info, and backfills their attendance.

-- ── Allow a servant with no group ("Unassigned") ────────────────────────────
-- Confirmed as a legitimate, permanent state (not just transitional): some
-- servants serve for weeks before a cohort decision is made, and some hold
-- purely administrative roles (marketing, food, trips) that never need a
-- cohort at all -- both still need general app access (servant directory,
-- QR codes, service calendar, attendance), gated by is_app_user() alone.
alter table user_roles drop constraint role_group_scope_check;
alter table user_roles add constraint role_group_scope_check check (
  (role in ('admin', 'general_coordinator') and group_id is null)
  or
  (role = 'sub_coordinator' and group_id is not null)
  or
  (role = 'servant')
);

-- ── pending_servants ─────────────────────────────────────────────────────────
create table pending_servants (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text not null,
  phone                  text,
  email                  text,
  father_of_confession   text,
  gender                 text check (gender in ('Male', 'Female')),
  registration_comments  text,
  submitted_at           timestamptz not null default now(),
  approved_at            timestamptz,
  approved_by            uuid references profiles(id),
  resulting_profile_id   uuid references profiles(id)
);

alter table pending_servants enable row level security;

create policy pending_servants_select on pending_servants for select
  using (is_admin_or_general_coordinator());

create policy pending_servants_update on pending_servants for update
  using (is_admin_or_general_coordinator()) with check (is_admin_or_general_coordinator());

-- No insert/delete policy for authenticated/anon -- rows are only ever
-- created by the security-definer checkin_submit_new_servant() below.

-- ── pending_servant_attendance ──────────────────────────────────────────────
-- Preserves every check-in date while still pending (not just the latest),
-- so a servant who's shown up for several weeks before being acknowledged
-- doesn't lose that history -- backfilled into real attendance_records once
-- linked to a real profile.
create table pending_servant_attendance (
  id                   uuid primary key default gen_random_uuid(),
  pending_servant_id   uuid not null references pending_servants(id) on delete cascade,
  service_date         date not null,
  created_at           timestamptz not null default now(),

  unique (pending_servant_id, service_date)
);

alter table pending_servant_attendance enable row level security;

create policy pending_servant_attendance_select on pending_servant_attendance for select
  using (is_admin_or_general_coordinator());

-- 0008_grants.sql's blanket grant only covered tables that existed when it
-- ran -- these two are new, so they need their own explicit grant.
grant select, update on pending_servants to authenticated;
grant select on pending_servant_attendance to authenticated;

-- ── checkin_get_flow ─────────────────────────────────────────────────────────
-- Bootstrap call for the public check-in page: tells the client whether this
-- token is a member-group QR or the servant QR, and the flow_type, before
-- it decides which list/mark/submit RPCs to call next (calling
-- checkin_list_members on an intake_only token raises an exception, so the
-- client needs this decided up front, not by trial and error).
create or replace function checkin_get_flow(p_token uuid)
returns table (is_servant boolean, flow_type qr_flow_type, label text)
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_flow     qr_flow_type;
  v_label    text;
  v_found    boolean;
begin
  select group_id, flow_type, true into v_group_id, v_flow, v_found
  from qr_codes where check_in_token = p_token;

  if not coalesce(v_found, false) then
    raise exception 'Invalid check-in code';
  end if;

  if v_group_id is null then
    v_label := 'Servants';
  else
    select name into v_label from groups where id = v_group_id;
  end if;

  return query select (v_group_id is null), v_flow, v_label;
end;
$$;

revoke all on function checkin_get_flow(uuid) from public;
grant execute on function checkin_get_flow(uuid) to anon, authenticated;

-- ── checkin_list_servants ───────────────────────────────────────────────────
-- Combined list of existing servants AND not-yet-approved pending servants,
-- so someone who self-registered last week and comes back this week finds
-- their own (pending) name instead of submitting a duplicate registration.
create or replace function checkin_list_servants(p_token uuid)
returns table (id uuid, full_name text, kind text)
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes where check_in_token = p_token;

  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  return query
    with combined as (
      select p.id, p.full_name, 'servant'::text as kind
      from profiles p
      where exists (select 1 from user_roles ur where ur.user_id = p.id and ur.role = 'servant')
      union all
      select ps.id, ps.full_name, 'pending'::text as kind
      from pending_servants ps
      where ps.resulting_profile_id is null
    )
    select * from combined order by full_name;
end;
$$;

revoke all on function checkin_list_servants(uuid) from public;
grant execute on function checkin_list_servants(uuid) to anon, authenticated;

-- ── checkin_mark_servant_attendance ─────────────────────────────────────────
-- For an EXISTING (already-registered) servant tapping their name.
create or replace function checkin_mark_servant_attendance(p_token uuid, p_servant_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes where check_in_token = p_token;

  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  if not exists (select 1 from profiles where id = p_servant_id) then
    raise exception 'Servant not found';
  end if;

  insert into attendance_records (attendee_type, servant_id, service_date)
  values ('servant', p_servant_id, current_date)
  on conflict (servant_id, service_date) do nothing;
end;
$$;

revoke all on function checkin_mark_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_servant_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_mark_pending_servant_attendance ─────────────────────────────────
-- For a not-yet-approved pending servant tapping their (pending) name again.
create or replace function checkin_mark_pending_servant_attendance(p_token uuid, p_pending_servant_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes where check_in_token = p_token;

  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  if not exists (select 1 from pending_servants where id = p_pending_servant_id and resulting_profile_id is null) then
    raise exception 'Pending servant not found';
  end if;

  insert into pending_servant_attendance (pending_servant_id, service_date)
  values (p_pending_servant_id, current_date)
  on conflict (pending_servant_id, service_date) do nothing;
end;
$$;

revoke all on function checkin_mark_pending_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_pending_servant_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_submit_new_servant ──────────────────────────────────────────────
-- "Don't see your name?" self-registration -- writes the pending_servants
-- row plus today's pending attendance in one shot, mirroring
-- checkin_submit_new_member's pattern. No account/profile/role is created
-- here (see the file header comment for why).
create or replace function checkin_submit_new_servant(
  p_token uuid,
  p_full_name text,
  p_phone text default null,
  p_email text default null,
  p_father_of_confession text default null,
  p_gender text default null,
  p_comments text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
  v_pending_id uuid;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes where check_in_token = p_token;

  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  insert into pending_servants (full_name, phone, email, father_of_confession, gender, registration_comments)
  values (p_full_name, p_phone, p_email, p_father_of_confession, p_gender, p_comments)
  returning id into v_pending_id;

  insert into pending_servant_attendance (pending_servant_id, service_date)
  values (v_pending_id, current_date)
  on conflict (pending_servant_id, service_date) do nothing;

  return v_pending_id;
end;
$$;

revoke all on function checkin_submit_new_servant(uuid, text, text, text, text, text, text) from public;
grant execute on function checkin_submit_new_servant(uuid, text, text, text, text, text, text) to anon, authenticated;

-- ── link_approved_pending_servant ───────────────────────────────────────────
-- Called from ensure-profile.ts right after a brand-new profile is created,
-- for EVERY sign-in (not just servants) -- a no-op unless an approved
-- pending_servants row matches this person's email. Runs as the newly-
-- signed-in user's own session, which has no RLS access to pending_servants
-- (Admin/GC-only) or to insert into user_roles -- security definer bypasses
-- both, scoped to auth.uid() (not a passed-in id) so one authenticated user
-- can never link a pending registration onto someone else's account.
create or replace function link_approved_pending_servant(p_email text)
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_pending record;
begin
  if v_uid is null or p_email is null then
    return;
  end if;

  select id, phone, father_of_confession, gender
  into v_pending
  from pending_servants
  where lower(email) = lower(p_email)
    and approved_at is not null
    and resulting_profile_id is null
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

revoke all on function link_approved_pending_servant(text) from public;
grant execute on function link_approved_pending_servant(text) to authenticated;

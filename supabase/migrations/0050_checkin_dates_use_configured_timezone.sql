-- 0050_checkin_dates_use_configured_timezone.sql
-- Owner-reported: today's real service attendance was mostly captured
-- under TOMORROW's date. Root cause: is_service_day() already correctly
-- resolves "today" in app_settings.timezone (0016_service_day_gating_and_
-- pending_delete.sql: `now() at time zone coalesce(timezone, 'America/
-- New_York')`), but every check-in RPC that actually WRITES or COMPARES a
-- service_date used bare `current_date` -- which Postgres evaluates in the
-- database SESSION's timezone (UTC on Supabase), not the app's configured
-- one. Eastern time is 4-5 hours behind UTC, so any check-in tapped after
-- ~7-8pm Eastern landed after UTC had already rolled to the next calendar
-- day: is_service_day() correctly said "yes, today's the service day," but
-- the actual insert then dated it tomorrow.
--
-- checkin_today() centralizes the fix: the same timezone-aware expression
-- is_service_day() already uses, exposed as a date. Every function below
-- is otherwise byte-for-byte identical to its current version (0046/0048)
-- -- only `current_date` is replaced with `checkin_today()`.

create or replace function checkin_today()
returns date
language sql
stable
security definer
as $$
  select (now() at time zone coalesce((select timezone from app_settings limit 1), 'America/New_York'))::date;
$$;

revoke all on function checkin_today() from public;
grant execute on function checkin_today() to anon, authenticated;

-- ── checkin_mark_attendance (member) ─────────────────────────────────────
drop function if exists checkin_mark_attendance(uuid, uuid);

create function checkin_mark_attendance(p_token uuid, p_member_id uuid)
returns table (
  attendance_recorded boolean,
  newly_created boolean,
  missing_phone boolean,
  missing_email boolean,
  missing_university boolean,
  missing_program boolean,
  missing_dob boolean,
  missing_father_of_confession boolean
)
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_flow     qr_flow_type;
  v_member_group uuid;
  v_is_visitor boolean;
  v_inserted_id uuid;
  v_member members%rowtype;
begin
  select group_id, flow_type into v_group_id, v_flow
  from qr_codes where check_in_token = p_token;

  if v_group_id is null then
    raise exception 'Invalid check-in code';
  end if;
  if v_flow <> 'check_in_and_intake' then
    raise exception 'This code does not support attendance check-in';
  end if;

  select * into v_member from members where id = p_member_id and status = 'active';
  v_member_group := v_member.group_id;
  v_is_visitor := v_member.is_visitor;

  if v_member_group is distinct from v_group_id then
    raise exception 'Member does not belong to this group';
  end if;

  if not is_service_day() then
    return query select
      false, false,
      (v_member.phone is null or trim(v_member.phone) = ''),
      (v_member.email is null or trim(v_member.email) = ''),
      (v_member.university_id is null),
      (v_member.program_of_study is null or trim(v_member.program_of_study) = ''),
      (v_member.date_of_birth is null),
      (v_member.father_of_confession is null or trim(v_member.father_of_confession) = '');
    return;
  end if;

  insert into attendance_records (attendee_type, member_id, service_date, is_visitor_at_time)
  values ('member', p_member_id, checkin_today(), coalesce(v_is_visitor, false))
  on conflict (member_id, service_date) do nothing
  returning id into v_inserted_id;

  return query select
    true, (v_inserted_id is not null),
    (v_member.phone is null or trim(v_member.phone) = ''),
    (v_member.email is null or trim(v_member.email) = ''),
    (v_member.university_id is null),
    (v_member.program_of_study is null or trim(v_member.program_of_study) = ''),
    (v_member.date_of_birth is null),
    (v_member.father_of_confession is null or trim(v_member.father_of_confession) = '');
end;
$$;

revoke all on function checkin_mark_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_mark_servant_attendance ──────────────────────────────────────
drop function if exists checkin_mark_servant_attendance(uuid, uuid);

create function checkin_mark_servant_attendance(p_token uuid, p_servant_id uuid)
returns table (attendance_recorded boolean, newly_created boolean)
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
  v_inserted_id uuid;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes q where q.check_in_token = p_token;

  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  if not exists (select 1 from profiles where id = p_servant_id) then
    raise exception 'Servant not found';
  end if;

  if not is_service_day() then
    return query select false, false;
    return;
  end if;

  insert into attendance_records (attendee_type, servant_id, service_date)
  values ('servant', p_servant_id, checkin_today())
  on conflict (servant_id, service_date) do nothing
  returning id into v_inserted_id;

  return query select true, (v_inserted_id is not null);
end;
$$;

revoke all on function checkin_mark_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_servant_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_mark_pending_servant_attendance ──────────────────────────────
drop function if exists checkin_mark_pending_servant_attendance(uuid, uuid);

create function checkin_mark_pending_servant_attendance(p_token uuid, p_pending_servant_id uuid)
returns table (attendance_recorded boolean, newly_created boolean)
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
  v_inserted_id uuid;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes q where q.check_in_token = p_token;

  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  if not exists (select 1 from pending_servants where id = p_pending_servant_id and resulting_profile_id is null) then
    raise exception 'Pending servant not found';
  end if;

  if not is_service_day() then
    return query select false, false;
    return;
  end if;

  insert into pending_servant_attendance (pending_servant_id, service_date)
  values (p_pending_servant_id, checkin_today())
  on conflict (pending_servant_id, service_date) do nothing
  returning id into v_inserted_id;

  return query select true, (v_inserted_id is not null);
end;
$$;

revoke all on function checkin_mark_pending_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_pending_servant_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_submit_new_member ────────────────────────────────────────────
drop function if exists checkin_submit_new_member(
  uuid, text, text, text, uuid, text, date, text, text, text, text
);

create function checkin_submit_new_member(
  p_token uuid,
  p_full_name text,
  p_phone text default null,
  p_email text default null,
  p_university_id uuid default null,
  p_program_of_study text default null,
  p_date_of_birth date default null,
  p_father_of_confession text default null,
  p_home_address text default null,
  p_gender text default null,
  p_comments text default null
)
returns table (member_id uuid, attendance_recorded boolean)
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_flow     qr_flow_type;
  v_new_member_id uuid;
  v_recorded boolean := false;
begin
  select group_id, flow_type into v_group_id, v_flow
  from qr_codes where check_in_token = p_token;

  if v_group_id is null then
    raise exception 'Invalid check-in code';
  end if;

  insert into members (
    group_id, full_name, phone, email, university_id, program_of_study,
    date_of_birth, father_of_confession, home_address, gender, registration_comments
  ) values (
    v_group_id, p_full_name, p_phone, p_email, p_university_id, p_program_of_study,
    p_date_of_birth, p_father_of_confession, p_home_address, p_gender, p_comments
  )
  returning id into v_new_member_id;

  if v_flow = 'check_in_and_intake' and is_service_day() then
    insert into attendance_records (attendee_type, member_id, service_date)
    values ('member', v_new_member_id, checkin_today())
    on conflict (member_id, service_date) do nothing;
    v_recorded := true;
  end if;

  return query select v_new_member_id, v_recorded;
end;
$$;

revoke all on function checkin_submit_new_member(
  uuid, text, text, text, uuid, text, date, text, text, text, text
) from public;
grant execute on function checkin_submit_new_member(
  uuid, text, text, text, uuid, text, date, text, text, text, text
) to anon, authenticated;

-- ── checkin_submit_new_servant ───────────────────────────────────────────
drop function if exists checkin_submit_new_servant(uuid, text, text, text, text, text, text);

create function checkin_submit_new_servant(
  p_token uuid,
  p_full_name text,
  p_phone text default null,
  p_email text default null,
  p_father_of_confession text default null,
  p_gender text default null,
  p_comments text default null
)
returns table (pending_id uuid, attendance_recorded boolean)
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
  v_pending_id uuid;
  v_recorded boolean := false;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes q where q.check_in_token = p_token;

  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  insert into pending_servants (full_name, phone, email, father_of_confession, gender, registration_comments)
  values (p_full_name, p_phone, p_email, p_father_of_confession, p_gender, p_comments)
  returning id into v_pending_id;

  if is_service_day() then
    insert into pending_servant_attendance (pending_servant_id, service_date)
    values (v_pending_id, checkin_today())
    on conflict (pending_servant_id, service_date) do nothing;
    v_recorded := true;
  end if;

  return query select v_pending_id, v_recorded;
end;
$$;

revoke all on function checkin_submit_new_servant(uuid, text, text, text, text, text, text) from public;
grant execute on function checkin_submit_new_servant(uuid, text, text, text, text, text, text) to anon, authenticated;

-- ── checkin_undo_attendance ──────────────────────────────────────────────
create or replace function checkin_undo_attendance(p_token uuid, p_member_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_member_group uuid;
begin
  select group_id into v_group_id from qr_codes where check_in_token = p_token;
  if v_group_id is null then
    raise exception 'Invalid check-in code';
  end if;

  select group_id into v_member_group from members where id = p_member_id;
  if v_member_group is distinct from v_group_id then
    raise exception 'Member does not belong to this group';
  end if;

  delete from attendance_records
  where member_id = p_member_id
    and attendee_type = 'member'
    and service_date = checkin_today()
    and created_at > now() - interval '2 minutes';
end;
$$;

revoke all on function checkin_undo_attendance(uuid, uuid) from public;
grant execute on function checkin_undo_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_undo_servant_attendance ──────────────────────────────────────
create or replace function checkin_undo_servant_attendance(p_token uuid, p_servant_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes q where q.check_in_token = p_token;
  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  delete from attendance_records
  where servant_id = p_servant_id
    and attendee_type = 'servant'
    and service_date = checkin_today()
    and created_at > now() - interval '2 minutes';
end;
$$;

revoke all on function checkin_undo_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_undo_servant_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_undo_pending_servant_attendance ──────────────────────────────
create or replace function checkin_undo_pending_servant_attendance(p_token uuid, p_pending_servant_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes q where q.check_in_token = p_token;
  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  delete from pending_servant_attendance
  where pending_servant_id = p_pending_servant_id
    and service_date = checkin_today()
    and created_at > now() - interval '2 minutes';
end;
$$;

revoke all on function checkin_undo_pending_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_undo_pending_servant_attendance(uuid, uuid) to anon, authenticated;

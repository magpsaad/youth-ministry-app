-- 0016_service_day_gating_and_pending_delete.sql
-- (1) Restricts self-check-in ATTENDANCE WRITES to the configured service
--     weekday (app_settings.service_weekday, already existed unused) --
--     registration itself (new member/servant info) is never blocked, only
--     the accompanying attendance record. The internal Attendance tab stays
--     unrestricted -- a signed-in servant deliberately recording a special-
--     event day is a different, accountable action from an anonymous QR
--     scan normalizing an ad-hoc day into the stats.
-- (2) Adds the missing delete policy for pending_servants (a pending
--     registration that never follows up needs a way to be removed).

create or replace function is_service_day()
returns boolean
language plpgsql
stable
security definer
as $$
declare
  v_weekday   smallint;
  v_timezone  text;
  v_today_dow int;
begin
  select service_weekday, timezone into v_weekday, v_timezone from app_settings limit 1;
  v_today_dow := extract(isodow from (now() at time zone coalesce(v_timezone, 'America/New_York')))::int;
  return v_today_dow = coalesce(v_weekday, 5);
end;
$$;

revoke all on function is_service_day() from public;
grant execute on function is_service_day() to anon, authenticated;

-- ── checkin_mark_attendance: void -> boolean (was recorded?) ────────────────
drop function if exists checkin_mark_attendance(uuid, uuid);

create function checkin_mark_attendance(p_token uuid, p_member_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_flow     qr_flow_type;
  v_member_group uuid;
  v_is_visitor boolean;
begin
  select group_id, flow_type into v_group_id, v_flow
  from qr_codes where check_in_token = p_token;

  if v_group_id is null then
    raise exception 'Invalid check-in code';
  end if;
  if v_flow <> 'check_in_and_intake' then
    raise exception 'This code does not support attendance check-in';
  end if;

  select group_id, is_visitor into v_member_group, v_is_visitor
  from members where id = p_member_id and status = 'active';

  if v_member_group is distinct from v_group_id then
    raise exception 'Member does not belong to this group';
  end if;

  if not is_service_day() then
    return false;
  end if;

  insert into attendance_records (attendee_type, member_id, service_date, is_visitor_at_time)
  values ('member', p_member_id, current_date, coalesce(v_is_visitor, false))
  on conflict (member_id, service_date) do nothing;

  return true;
end;
$$;

revoke all on function checkin_mark_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_submit_new_member: uuid -> table(member_id, attendance_recorded) ─
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
    values ('member', v_new_member_id, current_date)
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

-- ── checkin_mark_servant_attendance: void -> boolean ────────────────────────
drop function if exists checkin_mark_servant_attendance(uuid, uuid);

create function checkin_mark_servant_attendance(p_token uuid, p_servant_id uuid)
returns boolean
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

  if not exists (select 1 from profiles where id = p_servant_id) then
    raise exception 'Servant not found';
  end if;

  if not is_service_day() then
    return false;
  end if;

  insert into attendance_records (attendee_type, servant_id, service_date)
  values ('servant', p_servant_id, current_date)
  on conflict (servant_id, service_date) do nothing;

  return true;
end;
$$;

revoke all on function checkin_mark_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_servant_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_mark_pending_servant_attendance: void -> boolean ────────────────
drop function if exists checkin_mark_pending_servant_attendance(uuid, uuid);

create function checkin_mark_pending_servant_attendance(p_token uuid, p_pending_servant_id uuid)
returns boolean
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

  if not exists (select 1 from pending_servants where id = p_pending_servant_id and resulting_profile_id is null) then
    raise exception 'Pending servant not found';
  end if;

  if not is_service_day() then
    return false;
  end if;

  insert into pending_servant_attendance (pending_servant_id, service_date)
  values (p_pending_servant_id, current_date)
  on conflict (pending_servant_id, service_date) do nothing;

  return true;
end;
$$;

revoke all on function checkin_mark_pending_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_pending_servant_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_submit_new_servant: uuid -> table(pending_id, attendance_recorded) ─
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
    values (v_pending_id, current_date)
    on conflict (pending_servant_id, service_date) do nothing;
    v_recorded := true;
  end if;

  return query select v_pending_id, v_recorded;
end;
$$;

revoke all on function checkin_submit_new_servant(uuid, text, text, text, text, text, text) from public;
grant execute on function checkin_submit_new_servant(uuid, text, text, text, text, text, text) to anon, authenticated;

-- ── pending_servants: missing delete policy (issue #9 -- a registration
-- that never follows up needs a way to be removed) ─────────────────────────
create policy pending_servants_delete on pending_servants for delete
  using (is_admin_or_general_coordinator());

grant delete on pending_servants to authenticated;

-- 0048_checkin_fill_missing_fields.sql
-- Owner-requested: on the self-check-in success screen (member/youth flow
-- only), right after "Not you? Undo", offer to fill in whichever of
-- Phone/Email/University/Program of Study/Date of Birth/Father of
-- Confession are currently blank on their record -- never showing existing
-- data (privacy), never Servant Comments (confidential), and only the
-- fields that are actually empty.
--
-- checkin_mark_attendance now also reports which of those 6 fields are
-- missing, in the same call the client already makes to mark attendance --
-- avoids a second round trip, and keeps the "which fields are missing"
-- check server-side rather than shipping the record's real values to the
-- client to inspect.
--
-- checkin_fill_missing_member_fields writes only into fields that are
-- STILL blank at write time (coalesce-guarded), regardless of what the
-- client sends -- a defensive backstop so this anonymous, public endpoint
-- can never overwrite real data, even against a stale/replayed request.

-- ── checkin_mark_attendance: also reports which fields are blank ────────────
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
  values ('member', p_member_id, current_date, coalesce(v_is_visitor, false))
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

-- ── checkin_fill_missing_member_fields ───────────────────────────────────
create function checkin_fill_missing_member_fields(
  p_token uuid,
  p_member_id uuid,
  p_phone text default null,
  p_email text default null,
  p_university_id uuid default null,
  p_program_of_study text default null,
  p_date_of_birth date default null,
  p_father_of_confession text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_member_group uuid;
begin
  select group_id from qr_codes where check_in_token = p_token into v_group_id;
  if v_group_id is null then
    raise exception 'Invalid check-in code';
  end if;

  select group_id into v_member_group from members where id = p_member_id and status = 'active';
  if v_member_group is distinct from v_group_id then
    raise exception 'Member does not belong to this group';
  end if;

  -- coalesce-guarded: only ever fills a field that's still genuinely blank,
  -- regardless of what's passed in -- never overwrites real data.
  update members set
    phone = case when phone is null or trim(phone) = '' then nullif(trim(p_phone), '') else phone end,
    email = case when email is null or trim(email) = '' then nullif(trim(p_email), '') else email end,
    university_id = coalesce(university_id, p_university_id),
    program_of_study = case when program_of_study is null or trim(program_of_study) = '' then nullif(trim(p_program_of_study), '') else program_of_study end,
    date_of_birth = coalesce(date_of_birth, p_date_of_birth),
    father_of_confession = case when father_of_confession is null or trim(father_of_confession) = '' then nullif(trim(p_father_of_confession), '') else father_of_confession end
  where id = p_member_id;
end;
$$;

revoke all on function checkin_fill_missing_member_fields(uuid, uuid, text, text, uuid, text, date, text) from public;
grant execute on function checkin_fill_missing_member_fields(uuid, uuid, text, text, uuid, text, date, text) to anon, authenticated;

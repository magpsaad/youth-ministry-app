-- 0054_checkin_duplicate_member_detection.sql
-- Owner-reported: a youth's real, already-migrated record (from a different
-- cohort) went unnoticed when she used "New Youth Registration" instead of
-- finding her name in the tap-a-name list -- creating a duplicate would
-- have resulted, undetected, since the tap-a-name list only ever searches
-- the ONE cohort's own roster.
--
-- Design (agreed in chat): before actually creating a new member,
-- checkin_find_possible_duplicate_member() searches EVERY cohort in one
-- query for an exact match on full name, phone, or email. If found, the
-- client shows "we found a record that might be you" -- listing which
-- fields matched (safe: an echo of what she just typed, not new
-- information) and which differed (never the actual differing value,
-- just "different") -- and lets her say yes/no rather than silently
-- creating a duplicate. Only phone/email/university/program/DOB/gender
-- are compared this way; home address and Father of Confession are
-- free-text fields too prone to formatting/spelling noise to safely
-- label same/different (owner's explicit call), so they're excluded from
-- comparison here entirely -- the client always offers to update them
-- unconditionally instead, regardless of match status.
--
-- Ranking when multiple candidates match (owner's exact spec): a name
-- match always outranks a non-name match, however many other fields the
-- non-name match has; among candidates that tie on that, more total
-- matching fields (name+phone+email) wins; further ties prefer a match
-- on email, then phone.
--
-- checkin_resolve_duplicate_member() is the "yes, it's me" path -- applies
-- only the specific field updates she opted into, optionally moves her
-- record to the cohort she actually scanned into, and marks today's
-- attendance against her EXISTING record -- deliberately not reusing
-- checkin_mark_attendance(), since that function requires the member's
-- group to match the scanned QR's group (correct for the normal tap-a-
-- name flow, wrong here -- the whole point is letting her check in today
-- even if she doesn't move cohorts).

create or replace function checkin_find_possible_duplicate_member(
  p_token uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_university_id uuid default null,
  p_program_of_study text default null,
  p_date_of_birth date default null,
  p_gender text default null
)
returns table (
  member_id uuid,
  group_name text,
  same_group boolean,
  name_matches boolean,
  phone_matches boolean,
  email_matches boolean,
  university_matches boolean,
  program_matches boolean,
  dob_matches boolean,
  gender_matches boolean
)
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_flow     qr_flow_type;
begin
  select group_id, flow_type into v_group_id, v_flow
  from qr_codes where check_in_token = p_token;

  if v_group_id is null then
    raise exception 'Invalid check-in code';
  end if;
  if v_flow <> 'check_in_and_intake' then
    raise exception 'This code does not support attendance check-in';
  end if;

  return query
    select
      m.id,
      g.name,
      (m.group_id = v_group_id),
      (lower(trim(m.full_name)) = lower(trim(p_full_name))),
      (m.phone = p_phone),
      (lower(m.email) = lower(p_email)),
      case when p_university_id is null then null
           when m.university_id is null then false
           else (m.university_id = p_university_id) end,
      case when p_program_of_study is null or trim(p_program_of_study) = '' then null
           when m.program_of_study is null or trim(m.program_of_study) = '' then false
           else (lower(trim(m.program_of_study)) = lower(trim(p_program_of_study))) end,
      case when p_date_of_birth is null then null
           when m.date_of_birth is null then false
           else (m.date_of_birth = p_date_of_birth) end,
      case when p_gender is null or trim(p_gender) = '' then null
           when m.gender is null then false
           else (lower(m.gender) = lower(p_gender)) end
    from members m
    join groups g on g.id = m.group_id
    where m.status = 'active'
      and (
        lower(trim(m.full_name)) = lower(trim(p_full_name))
        or m.phone = p_phone
        or lower(m.email) = lower(p_email)
      )
    order by
      (lower(trim(m.full_name)) = lower(trim(p_full_name)))::int desc,
      (
        (lower(trim(m.full_name)) = lower(trim(p_full_name)))::int
        + (m.phone = p_phone)::int
        + (lower(m.email) = lower(p_email))::int
      ) desc,
      (lower(m.email) = lower(p_email))::int desc,
      (m.phone = p_phone)::int desc
    limit 1;
end;
$$;

revoke all on function checkin_find_possible_duplicate_member(uuid, text, text, text, uuid, text, date, text) from public;
grant execute on function checkin_find_possible_duplicate_member(uuid, text, text, text, uuid, text, date, text) to anon, authenticated;

create or replace function checkin_resolve_duplicate_member(
  p_token uuid,
  p_member_id uuid,
  p_move_to_scanned_group boolean,
  p_phone text default null,
  p_update_phone boolean default false,
  p_date_of_birth date default null,
  p_update_dob boolean default false,
  p_gender text default null,
  p_update_gender boolean default false,
  p_university_id uuid default null,
  p_update_university boolean default false,
  p_program_of_study text default null,
  p_update_program boolean default false,
  p_home_address text default null,
  p_update_home_address boolean default false,
  p_father_of_confession text default null,
  p_update_father_of_confession boolean default false
)
returns table (attendance_recorded boolean, newly_created boolean)
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_flow     qr_flow_type;
  v_is_visitor boolean;
  v_inserted_id uuid;
begin
  select group_id, flow_type into v_group_id, v_flow
  from qr_codes where check_in_token = p_token;

  if v_group_id is null then
    raise exception 'Invalid check-in code';
  end if;
  if v_flow <> 'check_in_and_intake' then
    raise exception 'This code does not support attendance check-in';
  end if;

  if not exists (select 1 from members where id = p_member_id and status = 'active') then
    raise exception 'Member not found';
  end if;

  update members set
    phone = case when p_update_phone then p_phone else phone end,
    date_of_birth = case when p_update_dob then p_date_of_birth else date_of_birth end,
    gender = case when p_update_gender then p_gender else gender end,
    university_id = case when p_update_university then p_university_id else university_id end,
    program_of_study = case when p_update_program then p_program_of_study else program_of_study end,
    home_address = case when p_update_home_address then p_home_address else home_address end,
    father_of_confession = case when p_update_father_of_confession then p_father_of_confession else father_of_confession end,
    group_id = case when p_move_to_scanned_group then v_group_id else group_id end
  where id = p_member_id
  returning is_visitor into v_is_visitor;

  if not is_service_day() then
    return query select false, false;
    return;
  end if;

  insert into attendance_records (attendee_type, member_id, service_date, is_visitor_at_time)
  values ('member', p_member_id, checkin_today(), coalesce(v_is_visitor, false))
  on conflict (member_id, service_date) do nothing
  returning id into v_inserted_id;

  return query select true, (v_inserted_id is not null);
end;
$$;

revoke all on function checkin_resolve_duplicate_member(
  uuid, uuid, boolean, text, boolean, date, boolean, text, boolean, uuid, boolean, text, boolean, text, boolean, text, boolean
) from public;
grant execute on function checkin_resolve_duplicate_member(
  uuid, uuid, boolean, text, boolean, date, boolean, text, boolean, uuid, boolean, text, boolean, text, boolean, text, boolean
) to anon, authenticated;

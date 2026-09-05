-- 0053_fix_ambiguous_member_id_new_registration.sql
-- Owner-reported: a new youth's self-registration ("New Youth Registration"
-- on the check-in QR) failed with "column reference \"member_id\" is
-- ambiguous" during last night's real service.
--
-- Root cause: checkin_submit_new_member()'s own signature is `returns
-- table (member_id uuid, attendance_recorded boolean)` -- inside a
-- plpgsql function, an OUT/RETURNS TABLE column name is also an implicit
-- variable in that function's scope. The function body's `insert into
-- attendance_records (...) ... on conflict (member_id, service_date) do
-- nothing` references `member_id` unqualified -- Postgres can't tell
-- whether that means attendance_records.member_id or the function's own
-- `member_id` OUT column, so it raises exactly this "ambiguous" error.
-- (This bug has existed since the function was first written, but only
-- actually runs the failing statement when `is_service_day()` is true --
-- i.e. only during a real service, for a brand new registration -- which
-- is why it went unnoticed until the app's actual go-live.)
--
-- Since the function is one atomic unit, that exception rolled back the
-- WHOLE call -- including the `insert into members` that had already
-- happened -- so the youth's registration was never actually saved (she
-- has no orphaned row from this attempt; confirmed directly against prod).
--
-- Fix: `#variable_conflict use_column` tells this function to always
-- prefer the table's own column whenever a name collides with one of its
-- OUT parameters -- which is exactly the (already-intended) behavior
-- here, since `member_id` is never read or written as the OUT parameter
-- inside this body at all (v_new_member_id is used for that throughout).
-- Otherwise byte-for-byte identical to the current version (0050).

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
#variable_conflict use_column
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

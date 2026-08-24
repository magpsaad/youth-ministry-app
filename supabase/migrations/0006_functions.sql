-- 0006_functions.sql
-- REQUIREMENTS.md §5, §6.11 / DATABASE_SCHEMA.md §15
-- (1) The atomic Group Transition function.
-- (2) Public, no-login RPC functions backing the QR check-in/intake pages.
--     These are not detailed in DATABASE_SCHEMA.md's original RLS sketch — that
--     sketch only covers *authenticated* access to the tables directly. The
--     public check-in page (REQUIREMENTS.md §6.11) has no login at all, so it
--     cannot go through table-level RLS as an authenticated user. The correct
--     pattern is what's used here: narrow, security-definer functions that
--     validate a QR's check_in_token and expose only what that flow needs,
--     granted to the `anon` role. RLS on the underlying tables (0007) stays
--     locked down for direct access; these functions are the one sanctioned
--     side door, and each does its own validation rather than trusting input.
--     None of these functions pin `search_path` — they resolve unqualified
--     names using whatever schema is active in the calling context (`qa` or
--     `prod`), which is what keeps this one file usable for both environments.
--     Supabase's PostgREST layer controls that context for RPC calls; an
--     external caller cannot manipulate it, so the usual "security definer
--     without a pinned search_path" hijacking risk doesn't apply here the way
--     it would for a function reachable via raw SQL.

-- ── Group Transition (§5) ───────────────────────────────────────────────────
create or replace function run_group_transition(new_pre_entry_cohort_year integer)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only Admins may run a Group Transition';
  end if;

  -- Advance every non-terminal, non-archived group one ladder position.
  update groups
  set ladder_position = ladder_position + 1
  where ladder_position < 5 and not is_archived;

  -- Regenerate names for every group using cohort-year-based naming.
  update groups
  set name = replace(
        replace(
          (select group_name_template from app_settings),
          '{cohort_year}', cohort_year::text
        ),
        '{position_label}',
        case when ladder_position >= 5 then '5+' else ladder_position::text end
      )
  where cohort_year is not null and not is_archived;
  -- (updated_at is bumped automatically by trg_groups_updated_at.)

  -- Create the new pre-entry (position 0) cohort for the upcoming intake year.
  insert into groups (cohort_year, ladder_position, name, display_order)
  values (
    new_pre_entry_cohort_year,
    0,
    replace(
      replace((select group_name_template from app_settings), '{cohort_year}', new_pre_entry_cohort_year::text),
      '{position_label}', '0'
    ),
    (select coalesce(max(display_order), 0) + 1 from groups)
  );

  -- Sub-Coordinators and Servants scoped to a group automatically follow it,
  -- since user_roles.group_id references the same group row whose position
  -- just advanced — no separate update needed here.

  insert into audit_log (user_id, action_type, details)
  values (auth.uid(), 'GROUP_TRANSITION_RUN',
          jsonb_build_object('new_pre_entry_cohort_year', new_pre_entry_cohort_year));
end;
$$;

-- Admin-only execute; enforced both here (raise exception) and at the grant level.
revoke all on function run_group_transition(integer) from public;
grant execute on function run_group_transition(integer) to authenticated;


-- ── Public QR check-in / intake RPCs (§6.11) ────────────────────────────────

-- List active members of a QR code's group, for the "select your name" picker.
-- Returns only id + full_name — no contact/personal details exposed publicly.
create or replace function checkin_list_members(p_token uuid)
returns table (member_id uuid, full_name text)
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
    select m.id, m.full_name
    from members m
    where m.group_id = v_group_id and m.status = 'active'
    order by m.full_name;
end;
$$;

revoke all on function checkin_list_members(uuid) from public;
grant execute on function checkin_list_members(uuid) to anon, authenticated;

-- Mark an existing member present today via their QR code.
create or replace function checkin_mark_attendance(p_token uuid, p_member_id uuid)
returns void
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

  insert into attendance_records (attendee_type, member_id, service_date, is_visitor_at_time)
  values ('member', p_member_id, current_date, coalesce(v_is_visitor, false))
  on conflict (member_id, service_date) do nothing;
end;
$$;

revoke all on function checkin_mark_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_attendance(uuid, uuid) to anon, authenticated;

-- New-member intake from a QR code. For a `check_in_and_intake` code, also
-- writes today's attendance record in the same call (REQUIREMENTS.md §6.11 —
-- new member + same-day attendance both captured instantly). For an
-- `intake_only` code (the position-0 pre-entry group), no attendance is written.
create or replace function checkin_submit_new_member(
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
returns uuid
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_flow     qr_flow_type;
  v_member_id uuid;
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
  returning id into v_member_id;

  if v_flow = 'check_in_and_intake' then
    insert into attendance_records (attendee_type, member_id, service_date)
    values ('member', v_member_id, current_date)
    on conflict (member_id, service_date) do nothing;
  end if;

  return v_member_id;
end;
$$;

revoke all on function checkin_submit_new_member(
  uuid, text, text, text, uuid, text, date, text, text, text, text
) from public;
grant execute on function checkin_submit_new_member(
  uuid, text, text, text, uuid, text, date, text, text, text, text
) to anon, authenticated;

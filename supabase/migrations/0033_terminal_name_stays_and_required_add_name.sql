-- 0033_terminal_name_stays_and_required_add_name.sql
-- REQUIREMENTS.md §2.2/§5/§6.9 -- two owner-requested changes, both about
-- not assuming a naming convention that might not hold in future years:
--
-- 1. A group's name is never auto-regenerated when it becomes (or stays)
--    the terminal group -- neither during run_group_transition() nor
--    during add_group_tier()'s "shift the current terminal up to make
--    room" step. Both used to build a name like "{cohort_year} and
--    earlier - Yr N+" from the group's cohort_year. The owner pointed out
--    a single cohort's display name might follow a completely different
--    convention year to year ("Year 1" one year, "2007 Cohort - Yr 1" the
--    next, "Cohort 2007" the year after) -- there's no safe assumption to
--    bake into a formula. Whatever name the group already has (set via
--    Group Names' rename_group, migration 0030) now simply carries
--    forward unchanged; only its ladder_position moves.
--
--    This also removes the only place cohort_year being null could break
--    a transition (building "null and earlier - Yr N+", which would then
--    fail groups' not-null name constraint) -- cohort_year is now purely
--    optional bookkeeping (it still needs to stay unique when provided),
--    never required for a group to safely reach the terminal position.
--
-- 2. add_group_tier()'s Name parameter is now required -- no more falling
--    back to group_name_template (or a generic "New Group N") when left
--    blank. Same reasoning: don't assume this year's template still
--    applies to a group that might still exist under a very different
--    naming convention years from now.

create or replace function run_group_transition(new_pre_entry_cohort_year integer)
returns void
language plpgsql
security definer
as $$
declare
  v_terminal_position     smallint;
  v_new_terminal_position smallint;
  v_old_terminal_group_id uuid;
  v_old_terminal_color    text;
  v_new_terminal_group    groups%rowtype; -- currently one below terminal, about to become the new terminal
  v_new_yr1_group_id      uuid;           -- currently ladder_position 0, about to become 1
  v_new_position0_id      uuid;
begin
  if not is_admin() then
    raise exception 'Only Admins may run a Group Transition';
  end if;

  select max(ladder_position) into v_terminal_position from groups where not is_archived;
  if v_terminal_position is null or v_terminal_position < 2 then
    raise exception 'Group Transition requires at least one active tier between the pre-entry group and the terminal group -- use Add Group on the App Settings screen first';
  end if;
  v_new_terminal_position := v_terminal_position - 1;

  select id, qr_color into v_old_terminal_group_id, v_old_terminal_color
    from groups where ladder_position = v_terminal_position and not is_archived limit 1;

  select * into v_new_terminal_group from groups where ladder_position = v_new_terminal_position and not is_archived limit 1;
  select id into v_new_yr1_group_id from groups where ladder_position = 0 and not is_archived limit 1;

  if v_new_terminal_group.id is not null then
    if v_old_terminal_group_id is not null then
      -- Members of the OLD terminal group merge into the row becoming the new terminal.
      update members set group_id = v_new_terminal_group.id where group_id = v_old_terminal_group_id;

      -- Servants/Sub-Coordinators/Read-Only of the OLD terminal group roll
      -- back to the new Yr 1, rather than following into the new terminal row.
      if v_new_yr1_group_id is not null then
        update user_roles set group_id = v_new_yr1_group_id where group_id = v_old_terminal_group_id;
      end if;

      -- Its own check-in QR is now defunct.
      delete from qr_codes where group_id = v_old_terminal_group_id;

      update groups set is_archived = true where id = v_old_terminal_group_id;
    end if;

    -- The row one below terminal becomes the new terminal group -- same
    -- row, ladder position advances. Its name and color are both left
    -- exactly as they are (owner's call, migration 0033) -- no formula
    -- assumed to still apply. Its own Servants/Sub-Coordinators/Read-Only
    -- naturally stay attached -- no group_id change needed, they just
    -- follow their row like any normal advance.
    update groups
    set ladder_position = v_terminal_position
    where id = v_new_terminal_group.id;
  end if;

  -- Advance every remaining non-terminal, non-archived group one position.
  update groups
  set ladder_position = ladder_position + 1
  where ladder_position < v_new_terminal_position and not is_archived;

  -- Regenerate names for every non-terminal position with a cohort_year on
  -- file (the terminal row's name is left alone, per above; a group with no
  -- cohort_year is also left alone, same as always).
  update groups
  set name = replace(
        replace(
          (select group_name_template from app_settings),
          '{cohort_year}', cohort_year::text
        ),
        '{position_label}', ladder_position::text
      )
  where cohort_year is not null and not is_archived and ladder_position < v_terminal_position;

  -- Keep every group-linked QR label in sync with its group's current name
  -- (also bumps qr_codes.updated_at via its own trigger, correctly
  -- flagging "Needs Reprint" for every group whose label just changed).
  update qr_codes
  set label = groups.name
  from groups
  where qr_codes.group_id = groups.id and not groups.is_archived;

  -- Create the new pre-entry (position 0) cohort, inheriting the OLD
  -- terminal group's color as it was immediately before being archived.
  insert into groups (cohort_year, ladder_position, name, display_order, qr_color)
  values (
    new_pre_entry_cohort_year,
    0,
    replace(
      replace((select group_name_template from app_settings), '{cohort_year}', new_pre_entry_cohort_year::text),
      '{position_label}', '0'
    ),
    (select coalesce(max(display_order), 0) + 1 from groups),
    v_old_terminal_color
  )
  returning id into v_new_position0_id;

  insert into qr_codes (group_id, label, image_path, flow_type)
  values (
    v_new_position0_id,
    (select name from groups where id = v_new_position0_id),
    '',
    'intake_only'
  );

  insert into audit_log (user_id, action_type, details)
  values (auth.uid(), 'GROUP_TRANSITION_RUN',
          jsonb_build_object('new_pre_entry_cohort_year', new_pre_entry_cohort_year,
                              'new_terminal_group_id', v_new_terminal_group.id,
                              'archived_old_terminal_group_id', v_old_terminal_group_id));
end;
$$;

create or replace function add_group_tier(p_cohort_year integer default null, p_name text default null, p_qr_color text default '#999999')
returns uuid
language plpgsql
security definer
as $$
declare
  v_terminal_position smallint;
  v_insert_position   smallint;
  v_terminal_id        uuid;
  v_new_id             uuid;
  v_name               text;
begin
  if not is_admin() then
    raise exception 'Only Admins may add a group';
  end if;
  v_name := nullif(trim(p_name), '');
  if v_name is null then
    raise exception 'Name is required';
  end if;

  select max(ladder_position) into v_terminal_position from groups where not is_archived;
  if v_terminal_position is null then
    raise exception 'No groups exist yet -- the pre-entry group must exist first';
  end if;

  if v_terminal_position = 0 then
    v_insert_position := 1;
  else
    v_insert_position := v_terminal_position;
    select id into v_terminal_id from groups where ladder_position = v_terminal_position and not is_archived limit 1;

    -- The current terminal group just shifts up a position to make room --
    -- its own name and color are left exactly as they are (owner's call,
    -- migration 0033), same reasoning as run_group_transition() above.
    update groups set ladder_position = v_terminal_position + 1 where id = v_terminal_id;
  end if;

  insert into groups (cohort_year, ladder_position, name, display_order, qr_color)
  values (p_cohort_year, v_insert_position, v_name, (select coalesce(max(display_order), 0) + 1 from groups), p_qr_color)
  returning id into v_new_id;

  insert into qr_codes (group_id, label, image_path) values (v_new_id, v_name, '');

  return v_new_id;
end;
$$;

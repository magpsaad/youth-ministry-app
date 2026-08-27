-- 0028_group_transition_merge_terminal.sql
-- REQUIREMENTS.md §2.2/§5/§6.15 -- revises the terminal (Yr 5+) tier's
-- design after owner review: it is now ONE single, permanent group SLOT
-- (not one row per graduated cohort) -- but critically, the SURVIVING row
-- each year is the cohort advancing from position 4, not a separate fixed
-- row. Distinguishing individual cohorts within the terminal tier is not
-- needed, not even for archiving -- members leave one at a time, on a
-- case-by-case basis, never as a whole-cohort batch.
--
-- Replaces 0006's run_group_transition(). This file went through three
-- owner-corrected drafts before landing here -- final, owner-confirmed model:
--
-- 1. Yr 4's row BECOMES the new terminal row, exactly like every other
--    position advances (0->1, 1->2, 2->3, 3->4) -- same row, same
--    already-assigned qr_color (untouched), just `ladder_position` set to
--    5 and its name regenerated as "{its cohort_year} and earlier - Yr 5+"
--    (not the generic 1-4 template). Its own Servants/Sub-Coordinators/
--    Read-Only naturally stay attached -- no group_id change at all,
--    exactly like a normal position advance.
-- 2. The OLD terminal row (whatever was ladder_position 5 before this
--    transition) is what gets absorbed and archived: its members merge
--    into the row that just became the new terminal, its own QR is
--    deleted, and its own Servants/Sub-Coordinators/Read-Only roll back to
--    the new Yr 1 (the group that was position 0, becoming position 1 in
--    this same transition) rather than following into the new terminal row.
-- 3. New Yr 0's color inherits the OLD terminal row's color, captured
--    immediately before that row is archived.

create or replace function run_group_transition(new_pre_entry_cohort_year integer)
returns void
language plpgsql
security definer
as $$
declare
  v_old_terminal_group_id uuid;
  v_old_terminal_color    text;
  v_new_terminal_group    groups%rowtype; -- currently ladder_position 4, about to become the new terminal
  v_new_yr1_group_id      uuid;           -- currently ladder_position 0, about to become 1
  v_new_position0_id      uuid;
begin
  if not is_admin() then
    raise exception 'Only Admins may run a Group Transition';
  end if;

  select id, qr_color into v_old_terminal_group_id, v_old_terminal_color
    from groups where ladder_position = 5 and not is_archived limit 1;

  select * into v_new_terminal_group from groups where ladder_position = 4 and not is_archived limit 1;
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

    -- Yr 4's row becomes the new terminal group -- same row, ladder
    -- position advances, name regenerated with the aggregate pattern. Its
    -- own color is untouched (keeps its already-assigned color, same as
    -- every other position advance). Its own Servants/Sub-Coordinators/
    -- Read-Only naturally stay attached -- no group_id change needed,
    -- they just follow their row like any normal advance.
    update groups
    set ladder_position = 5,
        name = v_new_terminal_group.cohort_year::text || ' and earlier - Yr 5+'
    where id = v_new_terminal_group.id;
  end if;

  -- Advance every remaining non-terminal, non-archived group (positions 0-3) one position.
  update groups
  set ladder_position = ladder_position + 1
  where ladder_position < 4 and not is_archived;

  -- Regenerate names for positions 1-4 (position 5's name was already set above).
  update groups
  set name = replace(
        replace(
          (select group_name_template from app_settings),
          '{cohort_year}', cohort_year::text
        ),
        '{position_label}', ladder_position::text
      )
  where cohort_year is not null and not is_archived and ladder_position < 5;

  -- Keep every group-linked QR label in sync with its group's current name
  -- (also bumps qr_codes.updated_at via its own trigger, correctly
  -- flagging "Needs Reprint" for every group whose label just changed --
  -- including the new terminal group).
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

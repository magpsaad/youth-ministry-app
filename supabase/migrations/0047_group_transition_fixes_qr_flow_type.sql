-- 0047_group_transition_fixes_qr_flow_type.sql
-- Owner asked (schedule moved up -- Group Transition running for real
-- tonight, going live tomorrow): does Yr0 becoming Yr1 during Group
-- Transition automatically switch its QR from intake-only to normal
-- check-in? No -- confirmed by reading run_group_transition() directly.
--
-- REQUIREMENTS.md is explicit: "the position-0 group's QR is intake_only
-- ... every other group's QR is check_in_and_intake." run_group_transition()
-- advances the group that WAS ladder_position 0 to ladder_position 1 (part
-- of its bulk "advance every remaining group one position" step), and syncs
-- every QR's *label* afterward, but never touches flow_type -- so that
-- group's QR silently stays intake_only forever after being promoted out
-- of the pre-entry slot. There's no admin screen to fix flow_type
-- manually either, so today the only way out would be raw SQL.
--
-- Confirmed via direct inspection (owner's real qa/prod data, both
-- checked): every group's flow_type is currently correct as of this
-- writing -- this bug has never actually fired yet on real data, so this
-- is purely a forward-looking fix for tonight's run, not a backfill.
--
-- add_group_tier()/delete_group_tier() (the other two functions that move
-- groups on the ladder) don't need the same fix: add_group_tier() only
-- ever creates a NEW group at position >= 1 (never position 0, which
-- already exists as a precondition), so its qr_codes insert already gets
-- the correct default ('check_in_and_intake', migration 0005). delete_group_tier()
-- explicitly refuses to touch position 0 and only ever shifts groups
-- already at position >= 2 down to >= 1, so it can never move a group
-- into or out of position 0 either.

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
    -- row, ladder position advances, name regenerated with the aggregate
    -- pattern. Its own color is untouched (keeps its already-assigned
    -- color, same as every other position advance). Its own Servants/
    -- Sub-Coordinators/Read-Only naturally stay attached -- no group_id
    -- change needed, they just follow their row like any normal advance.
    update groups
    set ladder_position = v_terminal_position,
        name = v_new_terminal_group.cohort_year::text || ' and earlier - Yr ' || v_terminal_position::text || '+'
    where id = v_new_terminal_group.id;
  end if;

  -- Advance every remaining non-terminal, non-archived group one position.
  update groups
  set ladder_position = ladder_position + 1
  where ladder_position < v_new_terminal_position and not is_archived;

  -- Regenerate names for every non-terminal position (the terminal row's
  -- name was already set above).
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
  -- flagging "Needs Reprint" for every group whose label just changed --
  -- including the new terminal group).
  update qr_codes
  set label = groups.name
  from groups
  where qr_codes.group_id = groups.id and not groups.is_archived;

  -- Owner-reported (real bug, fixed here): the group that WAS position 0
  -- is no longer the pre-entry group as of the advance above -- its QR
  -- needs to switch from intake-only to full check-in-and-intake, matching
  -- REQUIREMENTS.md's own rule ("every other group's QR is
  -- check_in_and_intake"). This never happened before, silently leaving
  -- the newly-promoted Yr1 stuck in intake-only mode indefinitely.
  if v_new_yr1_group_id is not null then
    update qr_codes set flow_type = 'check_in_and_intake' where group_id = v_new_yr1_group_id;
  end if;

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

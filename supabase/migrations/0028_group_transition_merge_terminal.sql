-- 0028_group_transition_merge_terminal.sql
-- REQUIREMENTS.md §2.2/§5/§6.15 -- revises the terminal (Yr 5+) tier's
-- design after owner review: it is now ONE single, permanent group row
-- (already exists -- the 2003 Cohort row seeded at ladder_position 5),
-- not a new row created at position 5 on every transition. Distinguishing
-- individual cohorts within the terminal tier is explicitly not needed,
-- not even for archiving -- members leave the terminal tier one at a time
-- as they voluntarily stop attending, never as a whole-cohort batch.
--
-- Replaces 0006's run_group_transition(). Two owner-confirmed corrections
-- to the first draft of this migration (never shipped):
--
-- 1. Youths at position 4 merge into the terminal group, but their
--    Servants/Sub-Coordinators/Read-Only grants do NOT follow them there --
--    they "roll back" to the freshest incoming cohort (the group that WAS
--    position 0, about to become position 1) instead, since servant energy
--    is better redirected to the newest cohort than kept on one that's now
--    mostly in the less-actively-managed terminal tier.
-- 2. QR colors: Years 1-4 keep their own already-assigned colors
--    unchanged (existing behavior, migration 0019/Phase E). The terminal
--    group's OWN color is NOT permanent -- each transition it updates to
--    the just-merged Yr 4 cohort's color (since the terminal tier's
--    population becomes dominated by whoever most recently joined it).
--    The brand-new incoming Yr 0 cohort inherits the terminal group's
--    color AS IT WAS immediately before that update -- i.e., last
--    transition's terminal color relays down to this transition's new
--    Yr 0, one step at a time, every transition.

create or replace function run_group_transition(new_pre_entry_cohort_year integer)
returns void
language plpgsql
security definer
as $$
declare
  v_terminal_group_id uuid;
  v_terminal_old_color text;
  v_outgoing_group     groups%rowtype;
  v_new_yr1_group_id   uuid; -- currently ladder_position 0, about to become 1
  v_new_position0_id   uuid;
begin
  if not is_admin() then
    raise exception 'Only Admins may run a Group Transition';
  end if;

  select id, qr_color into v_terminal_group_id, v_terminal_old_color
    from groups where ladder_position = 5 and not is_archived limit 1;
  if v_terminal_group_id is null then
    raise exception 'No terminal (Yr 5+) group found -- expected exactly one permanent row at ladder_position 5';
  end if;

  select * into v_outgoing_group from groups where ladder_position = 4 and not is_archived limit 1;
  select id into v_new_yr1_group_id from groups where ladder_position = 0 and not is_archived limit 1;

  if v_outgoing_group.id is not null then
    -- Youths merge into the terminal group.
    update members set group_id = v_terminal_group_id where group_id = v_outgoing_group.id;

    -- Servants/Sub-Coordinators/Read-Only roll back to the freshest
    -- incoming cohort rather than following their graduating youths.
    if v_new_yr1_group_id is not null then
      update user_roles set group_id = v_new_yr1_group_id where group_id = v_outgoing_group.id;
    end if;

    -- Terminal group's color updates to the just-merged cohort's color.
    update groups set qr_color = v_outgoing_group.qr_color where id = v_terminal_group_id;

    -- Its own check-in QR is now defunct -- the terminal group's own
    -- permanent QR is used going forward instead.
    delete from qr_codes where group_id = v_outgoing_group.id;

    update groups set is_archived = true where id = v_outgoing_group.id;
  end if;

  -- Advance every remaining non-terminal, non-archived group (positions 1-3) one position.
  update groups
  set ladder_position = ladder_position + 1
  where ladder_position < 4 and not is_archived;

  -- Regenerate names for positions 1-4 only -- the terminal group's name is
  -- permanent/admin-set and is never touched here.
  update groups
  set name = replace(
        replace(
          (select group_name_template from app_settings),
          '{cohort_year}', cohort_year::text
        ),
        '{position_label}', ladder_position::text
      )
  where cohort_year is not null and not is_archived and ladder_position < 5;

  -- Keep group-linked QR labels in sync with the just-regenerated names --
  -- also bumps qr_codes.updated_at via its own trigger, correctly flagging
  -- "Needs Reprint" for every group whose label just changed.
  update qr_codes
  set label = groups.name
  from groups
  where qr_codes.group_id = groups.id and groups.ladder_position < 5 and not groups.is_archived;

  -- Create the new pre-entry (position 0) cohort, inheriting the terminal
  -- group's color as it was BEFORE this transition's update above.
  insert into groups (cohort_year, ladder_position, name, display_order, qr_color)
  values (
    new_pre_entry_cohort_year,
    0,
    replace(
      replace((select group_name_template from app_settings), '{cohort_year}', new_pre_entry_cohort_year::text),
      '{position_label}', '0'
    ),
    (select coalesce(max(display_order), 0) + 1 from groups),
    v_terminal_old_color
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
                              'merged_group_id', v_outgoing_group.id));
end;
$$;

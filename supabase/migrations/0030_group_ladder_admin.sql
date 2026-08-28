-- 0030_group_ladder_admin.sql
-- REQUIREMENTS.md §2.2/§5/§6.9/§6.14/§6.15 -- generalizes the cohort ladder
-- (previously hardcoded around exactly 4 active years + 1 terminal tier,
-- i.e. ladder_position 0/4/5 as magic numbers throughout run_group_transition()
-- and the transition preview) so a deployment can have any number of active
-- tiers between the pre-entry group (always position 0) and the terminal
-- group (always whichever position is currently highest among active
-- groups). Adds the admin-facing "Group Names" tools this requires: rename,
-- add a new tier (extends the ladder by one), and remove a tier (closes the
-- gap). All three are security-definer RPCs, same pattern as
-- reassign_servant_group/remove_servant (migration 0022) and
-- run_group_transition itself (migration 0028) -- each checks is_admin()
-- internally rather than a blanket RLS write policy.
--
-- `groups.is_terminal` was a generated column hardcoded to `ladder_position
-- >= 5` -- now meaningless once the terminal position can be anything. It
-- was never actually read anywhere in the app (only ever selected and
-- discarded), so it's dropped outright rather than reworked; `lib/groups.ts`
-- now computes "is this the terminal row" app-side, from the actual max
-- ladder_position among the groups it already fetched.
--
-- "Delete" a group tier is implemented as archiving (is_archived = true),
-- never a real row delete -- members.group_id has no ON DELETE clause
-- (default RESTRICT), and historical attendance/outreach/audit data may
-- still reference members who once belonged to this group. Same philosophy
-- already used for the old terminal group every Group Transition.

alter table groups drop column is_terminal;

-- ── run_group_transition(): positions 0/4/5 replaced with the actual
-- current max ladder_position among active groups, so this works for any
-- ladder length instead of assuming exactly 4 active years. ────────────────
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

-- ── rename_group(): renames a group and keeps its QR label in sync. ────────
create or replace function rename_group(p_group_id uuid, p_name text)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Only Admins may rename a group';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Name cannot be empty';
  end if;

  update groups set name = p_name where id = p_group_id and not is_archived;
  update qr_codes set label = p_name where group_id = p_group_id;
end;
$$;

grant execute on function rename_group(uuid, text) to authenticated;

-- ── add_group_tier(): extends the ladder by one active tier, inserted
-- immediately below the current terminal group (which shifts up one
-- position to make room -- same "advance" semantics as a normal Group
-- Transition step, just for one row on demand). Handles the degenerate
-- case where the only active group so far is the pre-entry one (position
-- 0) -- nothing shifts, the new group is simply inserted at position 1. ────
create or replace function add_group_tier(p_cohort_year integer default null, p_name text default null, p_qr_color text default '#999999')
returns uuid
language plpgsql
security definer
as $$
declare
  v_terminal_position smallint;
  v_insert_position   smallint;
  v_terminal_id        uuid;
  v_terminal_cohort    integer;
  v_new_id             uuid;
  v_generated_name     text;
begin
  if not is_admin() then
    raise exception 'Only Admins may add a group';
  end if;

  select max(ladder_position) into v_terminal_position from groups where not is_archived;
  if v_terminal_position is null then
    raise exception 'No groups exist yet -- the pre-entry group must exist first';
  end if;

  if v_terminal_position = 0 then
    v_insert_position := 1;
  else
    v_insert_position := v_terminal_position;
    select id, cohort_year into v_terminal_id, v_terminal_cohort
      from groups where ladder_position = v_terminal_position and not is_archived limit 1;

    update groups
    set ladder_position = v_terminal_position + 1,
        name = case when v_terminal_cohort is not null
                     then v_terminal_cohort::text || ' and earlier - Yr ' || (v_terminal_position + 1)::text || '+'
                     else name end
    where id = v_terminal_id;

    update qr_codes set label = (select name from groups where id = v_terminal_id) where group_id = v_terminal_id;
  end if;

  v_generated_name := coalesce(
    nullif(trim(p_name), ''),
    case when p_cohort_year is not null
         then replace(
                replace((select group_name_template from app_settings), '{cohort_year}', p_cohort_year::text),
                '{position_label}', v_insert_position::text
              )
         else 'New Group ' || v_insert_position::text
    end
  );

  insert into groups (cohort_year, ladder_position, name, display_order, qr_color)
  values (p_cohort_year, v_insert_position, v_generated_name, (select coalesce(max(display_order), 0) + 1 from groups), p_qr_color)
  returning id into v_new_id;

  insert into qr_codes (group_id, label, image_path) values (v_new_id, v_generated_name, '');

  return v_new_id;
end;
$$;

grant execute on function add_group_tier(integer, text, text) to authenticated;

-- ── delete_group_tier(): archives one mid-ladder group and closes the gap
-- by shifting every higher position down by one. Refuses to touch the
-- pre-entry group (position 0) or the terminal group (merge it via Group
-- Transition instead) and refuses to archive a group that still has active
-- members or role grants attached, rather than silently orphaning them. ────
create or replace function delete_group_tier(p_group_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_position           smallint;
  v_terminal_position   smallint;
  v_active_members      integer;
  v_role_count          integer;
begin
  if not is_admin() then
    raise exception 'Only Admins may remove a group';
  end if;

  select ladder_position into v_position from groups where id = p_group_id and not is_archived;
  if v_position is null then
    raise exception 'Group not found or already archived';
  end if;
  if v_position = 0 then
    raise exception 'The pre-entry group cannot be removed here';
  end if;

  select max(ladder_position) into v_terminal_position from groups where not is_archived;
  if v_position = v_terminal_position then
    raise exception 'The terminal group cannot be removed directly -- merge it via Group Transition instead';
  end if;

  select count(*) into v_active_members from members where group_id = p_group_id and status = 'active';
  if v_active_members > 0 then
    raise exception 'This group still has % active member(s) -- reassign them to another group first', v_active_members;
  end if;

  select count(*) into v_role_count from user_roles where group_id = p_group_id;
  if v_role_count > 0 then
    raise exception 'This group still has % servant/coordinator role grant(s) -- reassign them first', v_role_count;
  end if;

  delete from qr_codes where group_id = p_group_id;
  update groups set is_archived = true where id = p_group_id;

  update groups set ladder_position = ladder_position - 1
  where ladder_position > v_position and not is_archived;
end;
$$;

grant execute on function delete_group_tier(uuid) to authenticated;

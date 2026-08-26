-- 0022_phase_f_coordinator_access.sql
-- REQUIREMENTS.md §4.1/§6.13 -- Phase F (Servant Profiles & Assignments,
-- Servants Attendance, Access Maintenance) surfaced two RLS gaps that Phases
-- A-E never needed:
--
-- 1. Sub-Coordinators must be able to VIEW the full servant directory
--    ("Servant Profiles & Assignments ... Sub-Coordinators can view this
--    screen") and edit a servant's basic contact fields, but `user_roles`
--    and `profiles` were only readable/writable by Admin/General Coordinator
--    or the row's own owner -- a Sub-Coordinator querying "every servant"
--    would silently see only their own row.
-- 2. Servants Attendance is a Coordinator Corner screen (General *and*
--    Sub-Coordinators, per §6.1), but `attendance_records`' servant branch
--    was gated to `is_admin_or_general_coordinator()` only.
--
-- Reassigning a servant's group or removing a servant stays General
-- Coordinator/Admin-only (§4.1's explicit restriction) -- rather than loosen
-- the blanket `user_roles` write policy (which would also hand Sub-Coordinators
-- the Admin-only Access Maintenance screen's full grant/revoke power), those
-- two specific operations are narrow `security definer` RPCs, matching this
-- project's established pattern (checkin_*, mark_qr_code_printed, etc.).

create or replace function is_coordinator(uid uuid default auth.uid())
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from user_roles
    where user_id = uid and role in ('admin', 'general_coordinator', 'sub_coordinator')
  );
$$;

-- Same treatment as 0013 -- `language sql` functions get inlined into the
-- calling query, re-resolving this body's unqualified `user_roles` against
-- the caller's search_path rather than this function's, unless pinned here.
do $$
declare
  v_schema text := current_schema();
begin
  execute format('alter function %I.is_coordinator(uuid) set search_path = %I, public', v_schema, v_schema);
end
$$;

-- Sub-Coordinators also need to see every group's NAME (not just their own)
-- for the cross-group Servant Directory / Servant Profiles & Assignments
-- listings (§6.13, unqualified "lists all servants") -- their other data
-- access (members/attendance/outreach) stays properly scoped elsewhere via
-- has_group_access() on those specific tables; this only affects reading
-- `groups.name` itself. The hidden position-0 pre-entry group stays
-- Admin-only regardless.
drop policy groups_select on groups;
create policy groups_select on groups for select
  using (
    (ladder_position = 0 and is_admin())
    or (ladder_position > 0 and (is_coordinator() or has_group_access(id)))
  );

drop policy user_roles_select on user_roles;
create policy user_roles_select on user_roles for select
  using (is_coordinator() or user_id = auth.uid());

drop policy profiles_update on profiles;
create policy profiles_update on profiles for update
  using (id = auth.uid() or is_coordinator())
  with check (id = auth.uid() or is_coordinator());

drop policy attendance_select on attendance_records;
create policy attendance_select on attendance_records for select
  using (
    (attendee_type = 'member' and has_group_access(
      (select group_id from members where members.id = member_id)))
    or
    (attendee_type = 'servant' and is_coordinator())
  );

drop policy attendance_insert on attendance_records;
create policy attendance_insert on attendance_records for insert
  with check (
    (attendee_type = 'member' and has_group_access(
      (select group_id from members where members.id = member_id)))
    or
    (attendee_type = 'servant' and is_coordinator())
  );

drop policy attendance_delete on attendance_records;
create policy attendance_delete on attendance_records for delete
  using (
    (attendee_type = 'member' and has_group_access(
      (select group_id from members where members.id = member_id)))
    or
    (attendee_type = 'servant' and is_coordinator())
  );

-- Reassign a servant's serving group -- General Coordinator/Admin only
-- (§4.1). Updates every 'servant' role row the user holds (normally exactly
-- one) to the new group; passing null moves them to "Unassigned".
create or replace function reassign_servant_group(p_user_id uuid, p_group_id uuid)
returns void language plpgsql security definer as $$
begin
  if not is_admin_or_general_coordinator() then
    raise exception 'Only General Coordinators/Admins can reassign a servant''s group';
  end if;

  update user_roles set group_id = p_group_id
  where user_id = p_user_id and role = 'servant';
end;
$$;

grant execute on function reassign_servant_group(uuid, uuid) to authenticated;

-- Remove a servant -- General Coordinator/Admin only (§4.1/§6.13). Drops
-- their 'servant' role row(s) and clears any members currently assigned to
-- them (a removed servant shouldn't remain listed as someone's caseload
-- owner). Deliberately does not touch other role rows the same person may
-- hold (e.g. a servant who is also a Sub-Coordinator keeps that role).
create or replace function remove_servant(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  if not is_admin_or_general_coordinator() then
    raise exception 'Only General Coordinators/Admins can remove a servant';
  end if;

  update members set assigned_servant_id = null, is_new_assignment = false
  where assigned_servant_id = p_user_id;

  delete from user_roles where user_id = p_user_id and role = 'servant';
end;
$$;

grant execute on function remove_servant(uuid) to authenticated;

-- ── audit_config seed ────────────────────────────────────────────────────────
-- Never seeded since 0005 created the table -- needed now so the Audit
-- Config screen has all 23 action types to toggle, and lib/audit.ts's
-- "row missing = treat as enabled" default has real rows to actually read.
insert into audit_config (action_type, enabled, description) values
  ('APP_ACCESS', true, 'Signed in and reached the landing page'),
  ('GROUP_SELECTED', true, 'Loaded a group''s data from the landing page'),
  ('MEMBER_EDITED', true, 'Edited a member''s details'),
  ('SERVANT_ASSIGNED', true, 'Assigned or unassigned a member to a servant'),
  ('OUTREACH_ADDED', true, 'Added an outreach entry'),
  ('OUTREACH_UPDATED', true, 'Updated an outreach entry'),
  ('OUTREACH_DELETED', true, 'Deleted an outreach entry'),
  ('MEMBER_PHOTO_UPLOADED', true, 'Uploaded or replaced a member''s photo'),
  ('SERVANT_PROFILES_VIEWED', true, 'Viewed Servant Profiles & Assignments'),
  ('SERVANT_ATTENDANCE_VIEWED', true, 'Viewed Servants Attendance'),
  ('SERVANT_EDITED', true, 'Edited a servant''s profile details'),
  ('SERVANT_GROUP_UPDATED', true, 'Reassigned a servant''s serving group'),
  ('SERVANT_PHOTO_UPLOADED', true, 'Uploaded or replaced a servant''s photo'),
  ('SERVANT_DELETED', true, 'Removed a servant'),
  ('ADMIN_ACCESS_MAINTENANCE', true, 'Changed a role/access grant'),
  ('ADMIN_UNIVERSITIES_MAINTENANCE', true, 'Changed the universities/affiliations list'),
  ('ATTENDANCE_ADDED', true, 'Marked someone present'),
  ('ATTENDANCE_REMOVED', true, 'Marked someone absent (removed a present record)'),
  ('CALENDAR_EVENT_CREATED', true, 'Created a calendar event'),
  ('CALENDAR_EVENT_UPDATED', true, 'Updated a calendar event'),
  ('CALENDAR_EVENT_DELETED', true, 'Deleted a calendar event'),
  ('MEMBER_ARCHIVED', true, 'Archived a member'),
  ('MEMBER_DELETED', true, 'Permanently deleted a member record'),
  ('GROUP_TRANSITION_RUN', true, 'Ran the Group Transition tool')
on conflict (action_type) do nothing;

-- 0024_read_only_access.sql
-- REQUIREMENTS.md §4.2 -- run this AFTER 0023 has already completed on its
-- own (see that file's note on why they can't run together).
--
-- `has_group_access()` is reused by every WRITE policy (members/attendance/
-- outreach insert-update-delete) as well as reads -- redefining it to
-- EXCLUDE 'read_only' rows means a read-only grant never accidentally
-- unlocks write access anywhere it's used. A new, separate function adds
-- read-only rows back in, and only the SELECT policies below are switched
-- to it.

alter table user_roles drop constraint role_group_scope_check;
alter table user_roles add constraint role_group_scope_check check (
  (role in ('admin', 'general_coordinator') and group_id is null)
  or
  (role = 'sub_coordinator' and group_id is not null)
  or
  (role = 'read_only' and group_id is not null)
  or
  (role = 'servant')
);

create or replace function has_group_access(gid uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer as $$
  select is_admin_or_general_coordinator(uid)
    or exists (
      select 1 from user_roles
      where user_id = uid and group_id = gid and role != 'read_only'
    );
$$;

create or replace function has_readonly_or_full_group_access(gid uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer as $$
  select has_group_access(gid, uid)
    or exists (
      select 1 from user_roles
      where user_id = uid and group_id = gid and role = 'read_only'
    );
$$;

do $$
declare
  v_schema text := current_schema();
begin
  execute format('alter function %I.has_group_access(uuid, uuid) set search_path = %I, public', v_schema, v_schema);
  execute format('alter function %I.has_readonly_or_full_group_access(uuid, uuid) set search_path = %I, public', v_schema, v_schema);
end
$$;

-- Read access only -- write policies (members_update/insert/delete,
-- outreach_insert/update/delete, attendance_insert/delete) are untouched
-- and still resolve through has_group_access(), which now excludes
-- 'read_only' rows.
drop policy members_select on members;
create policy members_select on members for select
  using (has_readonly_or_full_group_access(group_id));

drop policy outreach_select on outreach_entries;
create policy outreach_select on outreach_entries for select
  using (has_readonly_or_full_group_access((select group_id from members where members.id = member_id)));

drop policy attendance_select on attendance_records;
create policy attendance_select on attendance_records for select
  using (
    (attendee_type = 'member' and has_readonly_or_full_group_access(
      (select group_id from members where members.id = member_id)))
    or
    (attendee_type = 'servant' and is_coordinator())
  );

drop policy groups_select on groups;
create policy groups_select on groups for select
  using (
    (ladder_position = 0 and is_admin())
    or (ladder_position > 0 and (is_coordinator() or has_readonly_or_full_group_access(id)))
  );

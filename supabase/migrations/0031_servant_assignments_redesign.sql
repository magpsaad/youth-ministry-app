-- 0031_servant_assignments_redesign.sql
-- REQUIREMENTS.md §6.13 -- Servant Assignments redesigned to be aware that
-- one person can legitimately hold several `user_roles` rows at once
-- (Servant + Sub-Coordinator at the same cohort, Read-Only at several
-- others, etc. -- an intentional Phase F feature, §4.2) rather than the
-- "one servant = at most one cohort" assumption the old screen and its
-- backing RPC were built around.
--
-- reassign_servant_group(user_id, group_id) is replaced: it updated EVERY
-- 'servant' row for that user at once with no way to target just one,
-- which is exactly what produced the "duplicate key value violates unique
-- constraint" error the moment a person held two 'servant' rows (owner-
-- reported). All three new RPCs are row-scoped (operate on one
-- user_roles.id), matching the redesigned UI's per-chip actions:
--   - reassign_role_group: the Servant chip's "move to another cohort"
--     control (includes reassigning to Unassigned, i.e. group_id null).
--   - revoke_role_grant: the Sub-Coordinator/Read-Only chip's "x" (remove
--     just this one grant, not every grant this person holds).
--   - grant_servant_role: the "+ add a role" control, for adding another
--     Servant/Sub-Coordinator/Read-Only grant to someone who ALREADY
--     appears on this screen (already holds at least one grant) -- a
--     brand-new person's first grant still has to go through Access
--     Maintenance, deliberately, so this screen doesn't grow into a second
--     copy of that one's "Find a Person" flow.
--
-- All three check is_admin_or_general_coordinator() internally, same as
-- the function they replace -- user_roles' blanket RLS write policy is
-- Admin-only (0007_rls_policies.sql), so General Coordinators need these
-- narrow, checked entry points to act on Servant Assignments at all.

drop function if exists reassign_servant_group(uuid, uuid);

create or replace function reassign_role_group(p_role_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_role app_role;
begin
  if not is_admin_or_general_coordinator() then
    raise exception 'Only General Coordinators/Admins can reassign a role grant';
  end if;

  select role into v_role from user_roles where id = p_role_id;
  if v_role is null then
    raise exception 'Role grant not found';
  end if;
  if v_role <> 'servant' then
    raise exception 'Only Servant grants can be reassigned to a different group here';
  end if;

  update user_roles set group_id = p_group_id where id = p_role_id;
end;
$$;

grant execute on function reassign_role_group(uuid, uuid) to authenticated;

create or replace function revoke_role_grant(p_role_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_role    app_role;
  v_user_id uuid;
begin
  if not is_admin_or_general_coordinator() then
    raise exception 'Only General Coordinators/Admins can revoke a role grant';
  end if;

  select role, user_id into v_role, v_user_id from user_roles where id = p_role_id;
  if v_role is null then
    raise exception 'Role grant not found';
  end if;
  if v_role in ('admin', 'general_coordinator') then
    raise exception 'Admin and General Coordinator grants can only be revoked from Access Maintenance';
  end if;

  -- Mirrors remove_servant()'s cleanup (migration 0022) in case this is
  -- ever called on a 'servant' row -- a removed servant shouldn't remain
  -- listed as someone's caseload owner.
  if v_role = 'servant' then
    update members set assigned_servant_id = null, is_new_assignment = false
    where assigned_servant_id = v_user_id;
  end if;

  delete from user_roles where id = p_role_id;
end;
$$;

grant execute on function revoke_role_grant(uuid) to authenticated;

create or replace function grant_servant_role(p_user_id uuid, p_role app_role, p_group_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
begin
  if not is_admin_or_general_coordinator() then
    raise exception 'Only General Coordinators/Admins can grant a role here';
  end if;
  if p_role not in ('servant', 'sub_coordinator', 'read_only') then
    raise exception 'Only Servant, Sub-Coordinator, or Read-Only grants can be added here -- use Access Maintenance for Admin/General Coordinator roles';
  end if;
  if not exists (select 1 from user_roles where user_id = p_user_id) then
    raise exception 'This person has no existing role grant yet -- use Access Maintenance to grant their first one';
  end if;

  insert into user_roles (user_id, role, group_id) values (p_user_id, p_role, p_group_id)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function grant_servant_role(uuid, app_role, uuid) to authenticated;

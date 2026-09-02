-- 0036_dedup_null_group_roles_and_subcoord_servant.sql
-- Two independent fixes, owner-reported from the first real QA walkthrough
-- of the Servant Assignments screen:
--
-- 1. 0003's `unique (user_id, role, group_id)` never actually enforced
--    uniqueness for null-group grants (servant-Unassigned, general
--    coordinator) -- Postgres treats every NULL as distinct from every
--    other NULL for uniqueness purposes. The data migration tool's own
--    upsert (onConflict on those same 3 columns) silently never matched on
--    a re-run for that reason, so every one of the ~8 real `--run` attempts
--    against qa this session inserted a fresh duplicate row for anyone with
--    an Unassigned servant grant or a General Coordinator grant --
--    confirmed directly: 11 people, 8 duplicate rows apiece. This is what
--    produced the "8 redundant Servant Unassigned dropdowns" / "8 redundant
--    Gen. Coord chips" the owner saw, and also squeezed each row's name
--    column down to invisible on Servant Assignments (that many chips in
--    one flex row leaves ~0px for the name).
--
-- 2. Sub-Coordinators should always also be Servants of their own cohort
--    (owner-reported) -- enforced going forward with a trigger rather than
--    patched into each of the 3 places a sub_coordinator row can be
--    created (the migration tool, Servant Assignments' grant_servant_role,
--    Access Maintenance's direct insert), so it holds regardless of which
--    path is used, now or later.

-- ── Fix 1a: collapse existing null-group duplicates, keep the oldest ──
with ranked as (
  select id, row_number() over (
    partition by user_id, role
    order by created_at asc, id asc
  ) as rn
  from user_roles
  where group_id is null
)
delete from user_roles where id in (select id from ranked where rn > 1);

-- ── Fix 1b: a real constraint that actually catches null-group dupes ──
create unique index if not exists uq_user_roles_null_group on user_roles (user_id, role) where group_id is null;

-- ── Fix 1c: defense in depth -- grant_servant_role() blindly inserted with
-- no duplicate check at all; a coordinator double-clicking "Add" for the
-- same role/group could hit this exact bug live, not just via the
-- migration tool. Friendly error instead of a raw constraint-violation
-- message reaching the UI. ──
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
  if exists (
    select 1 from user_roles
    where user_id = p_user_id and role = p_role
      and group_id is not distinct from p_group_id
  ) then
    raise exception 'This person already holds that exact role/group grant';
  end if;

  insert into user_roles (user_id, role, group_id) values (p_user_id, p_role, p_group_id)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ── Fix 2a: backfill -- every current Sub-Coordinator also becomes a
-- Servant of that same cohort, if they aren't one already. ──
insert into user_roles (user_id, role, group_id)
select distinct sc.user_id, 'servant', sc.group_id
from user_roles sc
where sc.role = 'sub_coordinator'
  and not exists (
    select 1 from user_roles s
    where s.user_id = sc.user_id and s.role = 'servant' and s.group_id = sc.group_id
  );

-- ── Fix 2b: going forward, automatically. `on conflict do nothing` is safe
-- here (never a "which partial index?" ambiguity like the null-group case
-- above) because sub_coordinator's group_id is always non-null -- 0003's
-- original, non-partial `unique (user_id, role, group_id)` already covers
-- this exact insert shape. ──
create or replace function ensure_servant_for_sub_coordinator()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.role = 'sub_coordinator' then
    insert into user_roles (user_id, role, group_id)
    values (new.user_id, 'servant', new.group_id)
    on conflict (user_id, role, group_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_servant_for_sub_coordinator on user_roles;
create trigger trg_ensure_servant_for_sub_coordinator
after insert on user_roles
for each row execute function ensure_servant_for_sub_coordinator();

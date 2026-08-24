-- 0003_roles_and_access.sql
-- REQUIREMENTS.md §4 / DATABASE_SCHEMA.md §6
-- The permission model: user_roles, plus the helper functions every RLS policy relies on.

create table user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  role        app_role not null,
  group_id    uuid references groups(id),
  created_at  timestamptz not null default now(),

  constraint role_group_scope_check check (
    (role in ('admin', 'general_coordinator') and group_id is null)
    or
    (role in ('sub_coordinator', 'servant') and group_id is not null)
  ),

  unique (user_id, role, group_id)
);

create index idx_user_roles_user on user_roles (user_id);
create index idx_user_roles_group on user_roles (group_id);

-- ── Helper functions used throughout RLS policies (0007_rls_policies.sql) ──

create or replace function is_admin_or_general_coordinator(uid uuid default auth.uid())
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from user_roles
    where user_id = uid and role in ('admin', 'general_coordinator')
  );
$$;

create or replace function is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer as $$
  select exists (select 1 from user_roles where user_id = uid and role = 'admin');
$$;

create or replace function has_group_access(gid uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer as $$
  select is_admin_or_general_coordinator(uid)
    or exists (
      select 1 from user_roles
      where user_id = uid and group_id = gid
    );
$$;

create or replace function can_manage_servants(uid uuid default auth.uid())
returns boolean language sql stable security definer as $$
  -- Reassigning a servant's group, or removing a servant: General Coordinator / Admin only.
  select is_admin_or_general_coordinator(uid);
$$;

-- Any signed-in user holding at least one role row (used for "open to all
-- servants" style checks, e.g. Service Calendar event management).
create or replace function is_app_user(uid uuid default auth.uid())
returns boolean language sql stable security definer as $$
  select exists (select 1 from user_roles where user_id = uid);
$$;

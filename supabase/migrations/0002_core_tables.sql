-- 0002_core_tables.sql
-- REQUIREMENTS.md §2, §3.1-3.5 / DATABASE_SCHEMA.md §1-5
-- Dependency order: app_settings, universities, groups, profiles, members.

-- ── app_settings ────────────────────────────────────────────────────────────
create table app_settings (
  id                          boolean primary key default true,
  constraint app_settings_singleton check (id = true),

  app_title_long              text not null default 'Service Members Ministry',
  app_title_short             text not null default 'Members Ministry',
  app_subtitle                text not null default 'Servant Dashboard',
  logo_url                    text,

  theme_color                 text not null default '#1e3a5f',

  group_label                 text not null default 'Group',
  member_label                text not null default 'Member',

  group_name_template         text default '{cohort_year} Cohort - Yr {position_label}',
  current_service_year_label  text,

  app_version                 text not null default '4.0',

  same_day_cutoff_time        time not null default '21:00',
  timezone                    text not null default 'America/New_York',
  service_weekday             smallint not null default 5
    check (service_weekday between 1 and 7),

  updated_at                  timestamptz not null default now()
);

create trigger trg_app_settings_updated_at
  before update on app_settings
  for each row execute function set_updated_at();

-- ── universities ────────────────────────────────────────────────────────────
create table universities (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  proximity          proximity_type not null default 'Unknown',
  legacy_source_ref  text
);

create unique index uq_universities_legacy_ref on universities (legacy_source_ref)
  where legacy_source_ref is not null;

-- ── groups ──────────────────────────────────────────────────────────────────
create table groups (
  id                uuid primary key default gen_random_uuid(),
  cohort_year       integer,
  ladder_position   smallint not null,
  name              text not null,
  is_terminal       boolean generated always as (ladder_position >= 5) stored,
  is_archived       boolean not null default false,
  display_order     integer not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (cohort_year)
);

create index idx_groups_ladder_position on groups (ladder_position) where not is_archived;

create trigger trg_groups_updated_at
  before update on groups
  for each row execute function set_updated_at();

-- ── profiles (extends auth.users; Admins/Coordinators/Servants — never Members) ──
create table profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text not null,
  phone                 text,
  email                 text,
  father_of_confession  text,
  gender                text check (gender in ('Male', 'Female')),
  photo_path            text,
  legacy_source_ref     text,
  created_at            timestamptz not null default now()
);

create unique index uq_profiles_legacy_ref on profiles (legacy_source_ref)
  where legacy_source_ref is not null;

-- Auto-create a profile row whenever a new Supabase Auth user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── members (replaces "Youth" / per-year "Master List") ─────────────────────
create table members (
  id                     uuid primary key default gen_random_uuid(),
  group_id               uuid not null references groups(id),
  photo_path             text,
  full_name              text not null,
  phone                  text,
  email                  text,
  university_id          uuid references universities(id),
  program_of_study       text,
  date_of_birth          date,
  father_of_confession   text,
  home_address           text,
  is_visitor             boolean not null default false,
  gender                 text check (gender in ('Male', 'Female')),
  registration_comments  text,
  assigned_servant_id    uuid references profiles(id),
  servant_comments       text,
  is_new_assignment      boolean not null default false,
  status                 member_status not null default 'active',
  legacy_source_ref      text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_members_group on members (group_id) where status = 'active';
create index idx_members_assigned_servant on members (assigned_servant_id);
create unique index uq_members_legacy_ref on members (legacy_source_ref)
  where legacy_source_ref is not null;

create trigger trg_members_updated_at
  before update on members
  for each row execute function set_updated_at();

insert into app_settings (id) values (true);

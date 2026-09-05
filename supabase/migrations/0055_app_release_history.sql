-- 0055_app_release_history.sql
-- Owner-requested: a "Version Control" screen (System Admin Corner, full-
-- width button at the very bottom) replacing the "run SQL every time the
-- version changes" workflow -- lists every release with a description,
-- lets an Admin add new ones and edit even old entries.
--
-- app_releases is the new source of truth for "what version are we on":
-- the app-wide "Version X" badge (every page header) now shows whichever
-- release has the most recent released_on date, computed in
-- getAppSettings() -- app_settings.app_version itself is left in place,
-- untouched, purely as a last-resort fallback if this table is ever
-- empty (shouldn't happen in practice; seeded below).
--
-- Select is public (matches app_settings_select's `using (true)` --
-- REQUIREMENTS.md: branding must render with no session), since the
-- owner said they may open this screen to everyone as view-only later --
-- that'll only need loosening the page-level Admin gate then, no RLS
-- change. Write stays Admin-only, matching every other App Settings-style
-- screen (Verses/Universities/Calendar Maintenance).

create table app_releases (
  id           uuid primary key default gen_random_uuid(),
  version      text not null unique,
  description  text,
  released_on  date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_app_releases_updated_at
  before update on app_releases
  for each row execute function set_updated_at();

alter table app_releases enable row level security;

create policy app_releases_select on app_releases for select
  using (true);

create policy app_releases_write on app_releases for all
  using (is_admin()) with check (is_admin());

grant select on app_releases to anon, authenticated;
grant insert, update, delete on app_releases to authenticated;

-- Every other table got a one-time blanket grant in migration 0035; that
-- was a snapshot of tables existing AT THAT TIME, not a standing default
-- for tables created later -- this is the first new table since, so it
-- needs its own explicit grant (found the hard way: a service-role script
-- couldn't read this table at all until this line was added).
grant all privileges on app_releases to service_role;

-- Seed with the current known version so the badge never regresses.
insert into app_releases (version, description, released_on)
values ('4.1', 'Duplicate-member detection on self check-in, cross-cohort Export Lists, self check-in timezone fixes, and several smaller fixes.', current_date);

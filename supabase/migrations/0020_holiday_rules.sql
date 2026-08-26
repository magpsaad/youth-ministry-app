-- 0020_holiday_rules.sql
-- REQUIREMENTS.md §6.8 -- lets Admins add their own custom feasts/fasts
-- (e.g. St. Mary's Fast) to Calendar Maintenance's computed preload set,
-- with the correct date(s) computed automatically every year rather than
-- re-entered by hand. Supports both a fixed Gregorian-equivalent date
-- (most Coptic fixed feasts) and a date relative to that year's Pascha
-- (the movable feasts), each optionally spanning multiple days (a "fast"
-- leading up to a feast, not just the single feast day).

create table holiday_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  basis text not null check (basis in ('fixed', 'pascha')),
  start_month smallint check (start_month between 1 and 12),
  start_day smallint check (start_day between 1 and 31),
  start_offset integer,
  duration_days integer not null default 1 check (duration_days >= 1),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint holiday_rules_basis_fields check (
    (basis = 'fixed' and start_month is not null and start_day is not null and start_offset is null)
    or (basis = 'pascha' and start_offset is not null and start_month is null and start_day is null)
  )
);

alter table holiday_rules enable row level security;

create policy holiday_rules_admin_only on holiday_rules for all
  using (is_admin()) with check (is_admin());

-- Seed St. Mary's Fast, the owner's explicit example ("we don't hold
-- meetings during those 2 weeks") -- the 15-day fast preceding the Coptic
-- Feast of the Assumption (Aug 22 Gregorian-equivalent), so Aug 7 - Aug 21.
insert into holiday_rules (title, basis, start_month, start_day, duration_days)
values ('St. Mary''s Fast', 'fixed', 8, 7, 15);

-- 0004_operational_tables.sql
-- REQUIREMENTS.md §3.7-3.9 / DATABASE_SCHEMA.md §8-10
-- attendance_records, outreach_entries, service_calendar_events.
-- All three are "operational" tables per §10.1/§17: swept on every one-way
-- migration refresh, hence the legacy_source_ref column on each.

-- ── attendance_records ────────────────────────────────────────────────────
create table attendance_records (
  id                  uuid primary key default gen_random_uuid(),
  attendee_type       attendee_kind not null,
  member_id           uuid references members(id),
  servant_id          uuid references profiles(id),
  service_date        date not null,
  is_visitor_at_time  boolean not null default false,
  legacy_source_ref   text,
  created_at          timestamptz not null default now(),

  constraint attendance_exactly_one_attendee check (
    (attendee_type = 'member' and member_id is not null and servant_id is null)
    or
    (attendee_type = 'servant' and servant_id is not null and member_id is null)
  ),

  unique (member_id, service_date),
  unique (servant_id, service_date)
);

create index idx_attendance_member_date on attendance_records (member_id, service_date);
create index idx_attendance_servant_date on attendance_records (servant_id, service_date);
create index idx_attendance_service_date on attendance_records (service_date);
create unique index uq_attendance_legacy_ref on attendance_records (legacy_source_ref)
  where legacy_source_ref is not null;

-- ── outreach_entries ───────────────────────────────────────────────────────
create table outreach_entries (
  id                      uuid primary key default gen_random_uuid(),
  member_id               uuid not null references members(id),
  servant_id              uuid not null references profiles(id),
  occurred_at             timestamptz not null default now(),
  type                    text,
  notes                   text,
  follow_up_due           date,
  follow_up_dismissed_at  timestamptz,
  legacy_source_ref       text,
  created_at              timestamptz not null default now()
);

create index idx_outreach_member on outreach_entries (member_id);
create index idx_outreach_servant on outreach_entries (servant_id);
create index idx_outreach_follow_up on outreach_entries (follow_up_due)
  where follow_up_dismissed_at is null;
create unique index uq_outreach_legacy_ref on outreach_entries (legacy_source_ref)
  where legacy_source_ref is not null;

-- ── service_calendar_events ────────────────────────────────────────────────
create table service_calendar_events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  event_type      calendar_event_type not null,
  start_date      date not null,
  end_date        date not null,
  all_day         boolean not null default true,
  start_time      time,
  end_time        time,
  location        text,
  attachment_url  text,
  created_by      uuid not null references profiles(id),
  legacy_source_ref text,
  created_at      timestamptz not null default now(),

  check (end_date >= start_date)
);

create index idx_calendar_events_dates on service_calendar_events (start_date, end_date);
create unique index uq_calendar_events_legacy_ref on service_calendar_events (legacy_source_ref)
  where legacy_source_ref is not null;

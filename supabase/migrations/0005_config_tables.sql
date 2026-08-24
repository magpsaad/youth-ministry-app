-- 0005_config_tables.sql
-- REQUIREMENTS.md §3.10-3.13 / DATABASE_SCHEMA.md §11-14
-- actions_needed_config, audit_config, audit_log, qr_codes, verses.
-- Per §10.1/§17: actions_needed_config, audit_config, universities (already
-- created) and verses are "configuration" tables — seeded once at initial
-- migration, then owned by the app's own admin screens and excluded from the
-- ongoing refresh sweep. qr_codes and audit_log have no Sheets source at all.

-- ── actions_needed_config ───────────────────────────────────────────────────
create table actions_needed_config (
  proximity           proximity_type primary key,
  min_presence_count  integer not null default 0,
  min_absence_weeks   integer not null default 3,
  min_outreach_weeks  integer not null default 4,
  legacy_source_ref   text
);

insert into actions_needed_config (proximity, min_presence_count, min_absence_weeks, min_outreach_weeks) values
  ('Local',    0, 3, 4),
  ('Regional', 0, 3, 4),
  ('Abroad',   0, 6, 4),
  ('Unknown',  0, 3, 4);

-- ── audit_config / audit_log ────────────────────────────────────────────────
create table audit_config (
  action_type        audit_action_type primary key,
  enabled            boolean not null default true,
  description        text,
  legacy_source_ref  text
);

create table audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  user_id      uuid references profiles(id),
  action_type  audit_action_type not null,
  group_id     uuid references groups(id),
  details      jsonb
);

create index idx_audit_log_time on audit_log (occurred_at desc);
create index idx_audit_log_user on audit_log (user_id);
create index idx_audit_log_action on audit_log (action_type);

-- ── qr_codes ─────────────────────────────────────────────────────────────────
create table qr_codes (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid references groups(id),   -- null = the "Servants" QR
  label           text not null,
  image_path      text not null,
  check_in_token  uuid not null default gen_random_uuid() unique,
  flow_type       qr_flow_type not null default 'check_in_and_intake',
  printed_at      timestamptz,
  updated_at      timestamptz not null default now()
);

create trigger trg_qr_codes_updated_at
  before update on qr_codes
  for each row execute function set_updated_at();

-- ── verses ───────────────────────────────────────────────────────────────────
create table verses (
  id                 uuid primary key default gen_random_uuid(),
  text               text not null,
  reference          text,
  is_active          boolean not null default true,
  legacy_source_ref  text
);

create unique index uq_verses_legacy_ref on verses (legacy_source_ref)
  where legacy_source_ref is not null;

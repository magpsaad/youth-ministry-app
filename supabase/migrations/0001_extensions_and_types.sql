-- 0001_extensions_and_types.sql
-- Extensions and enumerated types. Schema-agnostic: run this against whichever
-- schema is current in search_path (see supabase/README.md for the prod/qa
-- deployment approach).

create extension if not exists pgcrypto;

create type app_role as enum ('admin', 'general_coordinator', 'sub_coordinator', 'servant');

create type member_status as enum ('active', 'archived');

create type calendar_event_type as enum
  ('Trip', 'Outing', 'Group Discussion', 'Speaker Session', 'Event', 'Holiday');

create type proximity_type as enum ('Local', 'Regional', 'Abroad', 'Unknown');

create type attendee_kind as enum ('member', 'servant');

create type qr_flow_type as enum ('check_in_and_intake', 'intake_only');

create type audit_action_type as enum (
  'APP_ACCESS', 'GROUP_SELECTED', 'MEMBER_EDITED', 'SERVANT_ASSIGNED',
  'OUTREACH_ADDED', 'OUTREACH_UPDATED', 'OUTREACH_DELETED',
  'MEMBER_PHOTO_UPLOADED', 'SERVANT_PROFILES_VIEWED', 'SERVANT_ATTENDANCE_VIEWED',
  'SERVANT_EDITED', 'SERVANT_GROUP_UPDATED', 'SERVANT_PHOTO_UPLOADED', 'SERVANT_DELETED',
  'ADMIN_ACCESS_MAINTENANCE', 'ADMIN_UNIVERSITIES_MAINTENANCE',
  'ATTENDANCE_ADDED', 'ATTENDANCE_REMOVED',
  'CALENDAR_EVENT_CREATED', 'CALENDAR_EVENT_UPDATED', 'CALENDAR_EVENT_DELETED',
  'MEMBER_ARCHIVED', 'MEMBER_DELETED', 'GROUP_TRANSITION_RUN'
);

-- Generic trigger function used by every table with an `updated_at` column.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

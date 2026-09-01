-- 0034_audit_log_legacy_ref.sql
-- REQUIREMENTS.md §10.1 / MIGRATION_PLAN.md §3.10 -- audit_log was originally
-- scoped as "new-app-only, never a mirror of anything" and so never got a
-- legacy_source_ref column like every other migrated table. Phase I planning
-- reversed that: the old app's Audit Log is now migrated and refreshed on
-- every "Data Refresh" run, so it needs the same tracking column as
-- members/attendance_records/outreach_entries/service_calendar_events.

alter table audit_log add column legacy_source_ref text;

create unique index uq_audit_log_legacy_ref on audit_log (legacy_source_ref)
  where legacy_source_ref is not null;

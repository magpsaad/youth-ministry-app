-- 0059_school_program_labels_and_proximity_toggle.sql
-- Owner-requested (making the app reusable by other services, e.g. Sunday
-- school): the "University/College" and "Program of Study" field labels
-- become admin-editable App Settings (like member_label/group_label), and
-- Proximity (Local/Regional/Abroad) becomes an optional feature.
--
--   university_label / program_label
--       Defaults are the generic wording for a NEW deployment ("School",
--       "Field of Focus"). An existing deployment that already uses the older
--       wording sets its own values on App Settings (or with a one-line
--       UPDATE) -- deliberately not done here so a fresh install keeps the
--       generic defaults.
--   proximity_enabled
--       When false the app treats every member as Local: Actions Needed uses
--       only the Local thresholds and the proximity badge/filter/column/chart
--       are hidden. Default true, so existing behaviour is unchanged.
--   show_proximity_on_attendance
--       Separately toggles the Proximity column on the Attendance tab while
--       proximity is enabled. Default true.
--
-- No grant/RLS changes needed: app_settings' grants and policies are
-- table-level (public select incl. anon for the check-in pages, admin-only
-- update), so new columns inherit them.

alter table app_settings add column university_label text not null default 'School';
alter table app_settings add column program_label text not null default 'Field of Focus';
alter table app_settings add column proximity_enabled boolean not null default true;
alter table app_settings add column show_proximity_on_attendance boolean not null default true;

-- Was "Changed the universities/affiliations list"; reworded to match the
-- generic "School" default now that the field's label is configurable.
update audit_config
set description = 'Changed the School list'
where action_type = 'ADMIN_UNIVERSITIES_MAINTENANCE';

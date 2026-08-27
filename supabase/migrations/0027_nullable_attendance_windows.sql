-- 0027_nullable_attendance_windows.sql
-- REQUIREMENTS.md §7.2 -- owner request: leaving either attendance-window
-- field blank means "no rolling cap at all" -- calculate over the person's
-- entire attendance history since their Join Date. Requires the columns to
-- actually allow null (0026 made them `not null default 52`).

alter table app_settings alter column youth_attendance_window_weeks drop not null;
alter table app_settings alter column servant_attendance_window_weeks drop not null;

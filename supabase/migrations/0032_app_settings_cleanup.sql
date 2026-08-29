-- 0032_app_settings_cleanup.sql
-- REQUIREMENTS.md §2.1/§6.14 -- two owner-requested cleanups to app_settings:
--
-- 1. Reset theme_color back to navy (#1e3a5f). It was changed to bright
--    green while testing what the setting actually does (it only tints
--    mobile browser chrome via the theme-color meta tag -- nothing in the
--    app's own UI, which is hardcoded navy throughout). The owner asked to
--    stop exposing this as an editable App Settings field but keep the
--    value itself as it always was.
--
-- 2. Drop current_service_year_label. Documented in DATABASE_SCHEMA.md as
--    "used in QR labels," but nothing in the actual codebase ever reads
--    it -- QR/group labels are driven entirely by group_name_template
--    instead. Confirmed dead via a full-codebase search before dropping.

update app_settings set theme_color = '#1e3a5f';

alter table app_settings drop column current_service_year_label;

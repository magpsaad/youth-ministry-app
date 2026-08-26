-- 0021_holiday_rules_grants.sql
-- 0020 created holiday_rules, but 0008_grants.sql's "grant ... on all tables
-- in schema" only covers tables that existed AT THE TIME 0008 ran -- it does
-- not retroactively apply to tables created later, so `authenticated` (the
-- role PostgREST/the app actually runs as) had no table-level grant on this
-- new table, surfacing as "permission denied for table holiday_rules" the
-- first time an Admin tried to add a custom rule through the UI.
grant select, insert, update, delete on holiday_rules to authenticated;

-- St. Mary's Fast (0020's seed row) is now baked directly into the built-in
-- Coptic Orthodox feast set (lib/holidays.ts) alongside 3 other permanent
-- feasts/fasts the owner asked to add -- delete the redundant custom-rule
-- copy so it doesn't show up twice in the preview.
delete from holiday_rules
where title = 'St. Mary''s Fast' and basis = 'fixed' and start_month = 8 and start_day = 7;

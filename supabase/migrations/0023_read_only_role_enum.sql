-- 0023_read_only_role_enum.sql
-- REQUIREMENTS.md §4.2 -- the owner asked for a genuine read-only access
-- grant for the cross-group "exception access" case (a servant who needs
-- visibility into a cohort they don't serve, but must NOT show up in that
-- cohort's servant-assignment dropdown or be able to edit its records).
-- The existing pattern (an extra Sub-Coordinator role row) grants full
-- read/write, which was more than intended.
--
-- IMPORTANT: run this file by itself, as its own SQL editor execution, and
-- ONLY AFTER it completes run 0024 separately. Postgres does not allow a
-- brand-new enum value to be referenced (e.g. in a CHECK constraint or RLS
-- policy) in the same transaction/script that added it.

alter type app_role add value 'read_only';

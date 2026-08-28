-- 0029_actions_needed_expansion.sql
-- REQUIREMENTS.md §6.3/§6.9/§7.1 -- supports the Actions Needed section's
-- expansion from one card type (Outreach Needed) to three (Outreach Needed,
-- Newly Assigned, Follow-up Due), plus a configurable Birthday window.
--
-- 1. Birthday window becomes admin-configurable (was hardcoded -7/+14 days
--    in application code) -- two new app_settings columns.
--
-- 2. `members.is_new_assignment` has existed since Phase 0 as a "notification
--    flag, cleared when the assigned servant views/dismisses it" but no code
--    path ever actually set it true -- assigning a servant always cleared it.
--    That's fixed in application code (assignServantAction) alongside this
--    migration. This trigger provides the other half: auto-clearing the flag
--    the moment any outreach entry is recorded for that member, exactly the
--    same "database trigger, code-path-independent" pattern as the join_date
--    trigger (migration 0026) -- so a servant who reaches out doesn't also
--    have to remember to separately dismiss the "newly assigned" card.

alter table app_settings add column birthday_window_days_before integer not null default 7;
alter table app_settings add column birthday_window_days_after integer not null default 14;

create or replace function clear_new_assignment_on_outreach()
returns trigger language plpgsql as $$
begin
  update members set is_new_assignment = false where id = new.member_id and is_new_assignment = true;
  return new;
end;
$$;

create trigger trg_outreach_clear_new_assignment
  after insert on outreach_entries
  for each row execute function clear_new_assignment_on_outreach();

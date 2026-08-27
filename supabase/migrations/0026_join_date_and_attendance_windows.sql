-- 0026_join_date_and_attendance_windows.sql
-- REQUIREMENTS.md §6.4/§6.13/§7.2 -- replaces `created_at` (a row-creation
-- timestamp, wrong for migrated data -- it would read as "joined the day
-- the migration ran") with a real, visible `join_date`: the earliest
-- attendance record on file for that person, member or servant alike.
-- Maintained by a trigger on attendance_records rather than scattered
-- across every code path that can write attendance (the internal
-- Attendance tab, public QR check-in, new-member/servant intake, servant
-- self-registration) -- this way it's automatically correct everywhere,
-- including any future attendance-writing feature, with nothing to keep
-- in sync by hand. Only ever moves earlier on insert; never recalculated
-- on delete (a routine correction shouldn't make someone's join date jump
-- around).
--
-- Also adds the two independent, admin-configurable rolling-attendance-
-- window settings (owner's explicit choice: weeks, starting at 52 for
-- both, floored at join_date so the window never reaches before someone
-- actually joined).

alter table members add column join_date date;
alter table profiles add column join_date date;

alter table app_settings add column youth_attendance_window_weeks integer not null default 52;
alter table app_settings add column servant_attendance_window_weeks integer not null default 52;

-- One-time backfill for whatever attendance history already exists.
update members m set join_date = (
  select min(service_date) from attendance_records
  where attendee_type = 'member' and member_id = m.id
) where join_date is null;

update profiles p set join_date = (
  select min(service_date) from attendance_records
  where attendee_type = 'servant' and servant_id = p.id
) where join_date is null;

create or replace function update_join_date_on_attendance()
returns trigger language plpgsql as $$
begin
  if new.attendee_type = 'member' then
    update members set join_date = new.service_date
    where id = new.member_id and (join_date is null or join_date > new.service_date);
  elsif new.attendee_type = 'servant' then
    update profiles set join_date = new.service_date
    where id = new.servant_id and (join_date is null or join_date > new.service_date);
  end if;
  return new;
end;
$$;

create trigger trg_attendance_update_join_date
  after insert on attendance_records
  for each row execute function update_join_date_on_attendance();

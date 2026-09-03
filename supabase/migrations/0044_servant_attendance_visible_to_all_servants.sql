-- 0044_servant_attendance_visible_to_all_servants.sql
-- Owner-reported: the Servant Directory shows N/A for every servant's
-- average attendance % when viewed by a plain Servant (no coordinator
-- role).
--
-- Root cause: attendance_select's servant branch (attendee_type =
-- 'servant') has been is_coordinator()-only since 0022, reaffirmed
-- deliberately in 0038's own comment ("really are coordinator-only
-- capabilities... managing another servant's attendance"). But the
-- Servant Directory itself (lib/servant-directory.ts) IS documented and
-- already widened (migration 0038) to be visible to every app user, not
-- just coordinators -- its own average-attendance calculation depends on
-- reading these same attendance_records rows, which a plain servant's
-- session simply can't see, so it silently computes over zero rows and
-- shows N/A for everyone, not just a scoping mistake specific to this
-- session's own user.
--
-- Fix: widen only the SELECT side of the servant branch to is_app_user()
-- (view), same pattern 0038 already used for groups_select/
-- user_roles_select. attendance_insert/attendance_delete (marking/
-- managing servant attendance) are untouched and stay is_coordinator()-
-- only -- and the Servants Attendance marking screen itself
-- (app/servants-attendance/page.tsx) already has its own explicit
-- isCoordinator/isAdmin page-level gate independent of this policy, so
-- widening read access here doesn't open that screen to plain servants.

drop policy attendance_select on attendance_records;
create policy attendance_select on attendance_records for select
  using (
    (attendee_type = 'member' and has_readonly_or_full_group_access(
      (select group_id from members where members.id = member_id)))
    or
    (attendee_type = 'servant' and is_app_user())
  );

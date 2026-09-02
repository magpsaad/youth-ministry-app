-- 0038_directory_and_qr_visible_to_all_servants.sql
-- Owner-reported: a brand-new plain servant (no cohort, no coordinator
-- role) signing in for the first time could only see their OWN entry in
-- the Servant Directory, and every QR code showed up mislabeled as "SAY
-- Servants" (repeated once per code) instead of its real cohort name.
--
-- Root cause, both bugs: migration 0022 widened `groups_select` and
-- `user_roles_select` from Admin/General-Coordinator-only to
-- `is_coordinator()` (adding Sub-Coordinators), but neither the Servant
-- Directory nor QR Codes are coordinator-only screens -- both are
-- documented as "visible to everyone with app access" (REQUIREMENTS.md
-- §6.1/§6.13/§6.15). A plain Servant with no group access at all:
--   - getServantDirectory() SELECTs user_roles for role IN ('servant',
--     'sub_coordinator', 'general_coordinator') across everyone -- RLS
--     silently filtered that down to just their own row.
--   - getQrCodesForPrinting() embeds groups(ladder_position, qr_color) for
--     each qr_codes row -- RLS made every real cohort's group row
--     invisible to them, so the embed resolved to null for ALL of them
--     (not just the true Servants QR, which has no group row to begin
--     with) -- collapsing every code's label/color to the Servants
--     fallback ("SAY Servants", purple) and defeating the position-0
--     exclusion filter too, since `r.group?.ladder_position` was
--     undefined for every row.
--
-- Fix: widen both SELECT policies to `is_app_user()` (any role holder),
-- not just `is_coordinator()` -- matching profiles_select, which already
-- got this right. The position-0 (pre-entry) group stays Admin-only
-- regardless -- untouched. The other four `is_coordinator()`-gated
-- policies from 0022 (profiles_update, and the three servant-branch
-- attendance_* policies) are deliberately NOT touched here -- those really
-- are coordinator-only capabilities (editing someone else's profile,
-- managing another servant's attendance), not "visible to everyone" ones.

drop policy groups_select on groups;
create policy groups_select on groups for select
  using (
    (ladder_position = 0 and is_admin())
    or (ladder_position > 0 and (is_app_user() or has_group_access(id)))
  );

drop policy user_roles_select on user_roles;
create policy user_roles_select on user_roles for select
  using (is_app_user() or user_id = auth.uid());

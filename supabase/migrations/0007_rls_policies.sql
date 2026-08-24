-- 0007_rls_policies.sql
-- REQUIREMENTS.md §4.4 / DATABASE_SCHEMA.md §7
-- RLS enabled on every table; deny by default, grant explicitly. DATABASE_SCHEMA.md
-- §7 fully specified `members`, `groups`, `user_roles`, and `attendance_records`;
-- the remaining tables were described as "follows the same pattern" — filled in
-- here concretely, following the same three helper functions throughout.

-- ── members ──────────────────────────────────────────────────────────────────
alter table members enable row level security;

create policy members_select on members for select
  using (has_group_access(group_id));

create policy members_update on members for update
  using (has_group_access(group_id));

create policy members_insert on members for insert
  with check (has_group_access(group_id));

create policy members_delete on members for delete
  using (is_admin());

-- ── groups ───────────────────────────────────────────────────────────────────
alter table groups enable row level security;

create policy groups_select on groups for select
  using (
    (ladder_position = 0 and is_admin())
    or (ladder_position > 0 and has_group_access(id))
  );

create policy groups_admin_write on groups for all
  using (is_admin()) with check (is_admin());

-- ── profiles ─────────────────────────────────────────────────────────────────
alter table profiles enable row level security;

create policy profiles_select on profiles for select
  using (is_app_user() or id = auth.uid());

create policy profiles_update on profiles for update
  using (id = auth.uid() or is_admin_or_general_coordinator())
  with check (id = auth.uid() or is_admin_or_general_coordinator());

-- A signed-in user may create their own profile row (and only their own) --
-- this is how lazy, environment-aware profile provisioning (0002's comment,
-- web/src/lib/supabase/ensure-profile.ts) is allowed to work under RLS,
-- since it runs as the authenticated user rather than a privileged role.
create policy profiles_insert on profiles for insert
  with check (id = auth.uid());

-- ── user_roles ───────────────────────────────────────────────────────────────
alter table user_roles enable row level security;

create policy user_roles_select on user_roles for select
  using (is_admin_or_general_coordinator() or user_id = auth.uid());

create policy user_roles_admin_write on user_roles for all
  using (is_admin()) with check (is_admin());

-- Belt-and-braces: even under an "admin write" policy, explicitly document
-- that Sub-Coordinators can never touch a servant's own role row (REQUIREMENTS.md
-- §6.13) — already true above since only is_admin() (not general_coordinator)
-- passes user_roles_admin_write today. Re-evaluate this policy if General
-- Coordinators are ever meant to write user_roles directly through the app
-- rather than only through an admin-reviewed flow.

-- ── attendance_records ─────────────────────────────────────────────────────
alter table attendance_records enable row level security;

create policy attendance_select on attendance_records for select
  using (
    (attendee_type = 'member' and has_group_access(
      (select group_id from members where members.id = member_id)))
    or
    (attendee_type = 'servant' and is_admin_or_general_coordinator())
  );

create policy attendance_insert on attendance_records for insert
  with check (
    (attendee_type = 'member' and has_group_access(
      (select group_id from members where members.id = member_id)))
    or
    (attendee_type = 'servant' and is_admin_or_general_coordinator())
  );

create policy attendance_delete on attendance_records for delete
  using (
    (attendee_type = 'member' and has_group_access(
      (select group_id from members where members.id = member_id)))
    or
    (attendee_type = 'servant' and is_admin_or_general_coordinator())
  );

-- ── outreach_entries ─────────────────────────────────────────────────────────
alter table outreach_entries enable row level security;

create policy outreach_select on outreach_entries for select
  using (has_group_access((select group_id from members where members.id = member_id)));

create policy outreach_insert on outreach_entries for insert
  with check (has_group_access((select group_id from members where members.id = member_id)));

create policy outreach_update on outreach_entries for update
  using (servant_id = auth.uid())
  with check (servant_id = auth.uid());

create policy outreach_delete on outreach_entries for delete
  using (servant_id = auth.uid());

-- ── service_calendar_events ────────────────────────────────────────────────
alter table service_calendar_events enable row level security;

create policy calendar_select on service_calendar_events for select
  using (is_app_user());

create policy calendar_write on service_calendar_events for all
  using (is_app_user()) with check (is_app_user());
  -- Confirmed intentional (REQUIREMENTS.md §6.8): open to all servants, not
  -- restricted to Coordinators/Admins.

-- ── actions_needed_config ────────────────────────────────────────────────────
alter table actions_needed_config enable row level security;

create policy actions_needed_config_select on actions_needed_config for select
  using (is_app_user());

create policy actions_needed_config_write on actions_needed_config for all
  using (is_admin()) with check (is_admin());

-- ── audit_config / audit_log ────────────────────────────────────────────────
alter table audit_config enable row level security;

create policy audit_config_admin_only on audit_config for all
  using (is_admin()) with check (is_admin());

alter table audit_log enable row level security;

create policy audit_log_select on audit_log for select
  using (is_admin());

create policy audit_log_insert on audit_log for insert
  with check (is_app_user());
  -- Any recognized app user may write their own audit entries; only Admins
  -- can read the log back (REQUIREMENTS.md §6.14). No update/delete policy —
  -- the log is append-only outside of the admin archive-by-age tool, which
  -- should use the service role, not end-user RLS.

-- ── qr_codes ─────────────────────────────────────────────────────────────────
alter table qr_codes enable row level security;

create policy qr_codes_select on qr_codes for select
  using (is_app_user());

create policy qr_codes_write on qr_codes for all
  using (is_admin_or_general_coordinator()) with check (is_admin_or_general_coordinator());

-- Note: the public check-in/intake pages never touch qr_codes directly under
-- end-user RLS — they go through the security-definer functions in
-- 0006_functions.sql, which look up qr_codes internally.

-- ── verses ───────────────────────────────────────────────────────────────────
alter table verses enable row level security;

create policy verses_select on verses for select
  using (is_app_user());

create policy verses_write on verses for all
  using (is_admin()) with check (is_admin());

-- ── app_settings ─────────────────────────────────────────────────────────────
alter table app_settings enable row level security;

create policy app_settings_select on app_settings for select
  using (true);
  -- Public: branding (app title/logo/theme) must render on the login screen
  -- and on the public QR check-in/intake pages, both reachable with no session.

create policy app_settings_write on app_settings for update
  using (is_admin()) with check (is_admin());

-- ── universities ─────────────────────────────────────────────────────────────
alter table universities enable row level security;

create policy universities_select on universities for select
  using (true);
  -- Public: the university/affiliation dropdown is needed on the public,
  -- no-login New Member intake form (REQUIREMENTS.md §6.11).

create policy universities_write on universities for all
  using (is_admin()) with check (is_admin());

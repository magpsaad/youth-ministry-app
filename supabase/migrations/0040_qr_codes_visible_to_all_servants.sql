-- 0040_qr_codes_visible_to_all_servants.sql
-- Owner-reported, from the exceptional-workflow retest of 0038's own fix:
-- QR Codes still showed only Yr1-5+ (no Yr0), and the Servants QR twice.
--
-- Root cause: getQrCodesForPrinting() embeds groups(ladder_position,
-- qr_color) per qr_codes row and used whether that embed resolved (`r.group
-- ? ... : "SAY Servants"`) to decide BOTH the pre-entry exclusion filter
-- AND the display label/color -- which conflates two different things:
-- "this row genuinely has no group" (qr_codes.group_id is null -- the one
-- true Servants QR) vs. "the joined group row didn't resolve because RLS
-- hid it from this caller." groups_select's position-0 branch is still
-- (deliberately) Admin-only after 0038, so for anyone else the Yr0 QR's
-- `group` embed is always null -- indistinguishable, in that code, from
-- the real Servants row. Both ended up mislabeled "SAY Servants" with the
-- same purple fallback color, reading as "the Servants QR twice" with Yr0
-- nowhere to be found.
--
-- Owner's explicit call once this surfaced: everyone should be able to see
-- every QR code, Yr0 included -- not just Admin/General Coordinator. So
-- this drops the pre-entry exclusion entirely (not just fixes the
-- mislabeling) and reads through a security-definer function so the real
-- ladder_position/qr_color/name data is always available regardless of
-- groups_select's position-0 restriction, which stays in place for every
-- OTHER surface (Servant Directory, the ordinary group selector, etc.) --
-- this is the one screen that now deliberately needs to see it anyway.

create or replace function get_qr_codes_with_groups()
returns table (
  id uuid,
  label text,
  check_in_token uuid,
  printed_at timestamptz,
  updated_at timestamptz,
  group_id uuid,
  ladder_position integer,
  qr_color text
)
language sql
stable
security definer
as $$
  select q.id, q.label, q.check_in_token, q.printed_at, q.updated_at,
         q.group_id, g.ladder_position, g.qr_color
  from qr_codes q
  left join groups g on g.id = q.group_id;
$$;

revoke all on function get_qr_codes_with_groups() from public;
grant execute on function get_qr_codes_with_groups() to authenticated;

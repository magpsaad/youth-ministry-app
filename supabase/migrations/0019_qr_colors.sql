-- 0019_qr_colors.sql
-- REQUIREMENTS.md §6.15 -- QR frame color must belong to the cohort (the
-- group row), not to "whichever cohort currently sits at Year 1" -- a
-- future Group Transition renames a group and advances its ladder
-- position, but this column stays untouched, so "2007 Cohort" keeps the
-- same color for its entire lifetime as it climbs Year 1 -> Year 2 -> ...
--
-- Backfill assigns colors by each group's CURRENT ladder_position, since
-- that's what's actually visible in the QR view today -- sampled directly
-- from the old app's real QR image files (Photos/QR Codes folder in
-- Drive), not guessed. Position 0 gets a new, lighter orange (distinct
-- from position 3's red-orange) per the owner's request.

alter table groups add column qr_color text;

update groups set qr_color = case ladder_position
  when 0 then '#FFA640'  -- new: Year 0 (lighter, distinct from Year 3's red-orange)
  when 1 then '#8C7F5C'  -- sampled: old app's "25-26 Year 1.png"
  when 2 then '#3F32F1'  -- sampled: old app's "25-26 Year 2.png"
  when 3 then '#F34D27'  -- sampled: old app's "25-26 Year 3.png"
  when 4 then '#4EB132'  -- sampled: old app's "25-26 Year 4+.png"
  else        '#F5D447'  -- sampled: old app's "25-26 Year 5+.png" (terminal, 5+)
end
where qr_color is null;

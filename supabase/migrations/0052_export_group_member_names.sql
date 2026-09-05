-- 0052_export_group_member_names.sql
-- Owner-requested: on the Export Lists screen, a Sub-Coordinator should be
-- able to print/export the names list for ANY cohort, not just the one
-- they're actually assigned to -- "there is no risk of data leaking since
-- it's just a list of names only."
--
-- The plain `select full_name from members where group_id = ...` this
-- screen used before was still gated by members_select's RLS policy
-- (has_readonly_or_full_group_access(group_id)) regardless of which
-- columns were selected -- RLS applies to rows, not columns, so a
-- Sub-Coordinator picking a cohort they don't serve just silently got zero
-- names back. A security definer RPC that self-checks "is this caller a
-- Coordinator/Admin at all" (matching this screen's own page-level access
-- gate) and then bypasses the per-cohort RLS restriction is the
-- established pattern for exactly this kind of intentional, narrow
-- permission broadening elsewhere in this project (remove_servant,
-- run_group_transition, the checkin_* functions, etc.).

create or replace function export_group_member_names(p_group_id uuid)
returns table (full_name text)
language plpgsql
security definer
as $$
begin
  if not is_coordinator() then
    raise exception 'Only Coordinators/Admins can export a names list';
  end if;

  return query
    select m.full_name
    from members m
    where m.group_id = p_group_id and m.status = 'active'
    order by m.full_name;
end;
$$;

revoke all on function export_group_member_names(uuid) from public;
grant execute on function export_group_member_names(uuid) to authenticated;

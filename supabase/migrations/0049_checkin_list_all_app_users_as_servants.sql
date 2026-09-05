-- 0049_checkin_list_all_app_users_as_servants.sql
-- Owner-requested: the Servants check-in list (checkin_list_servants) only
-- included profiles holding an explicit 'servant' role row, so General
-- Coordinators, Sub-Coordinators, Admins, and read-only-only users never
-- appeared in the list to check themselves in. `profiles` only ever holds
-- Admins/Coordinators/Servants (never Members -- 0002_core_tables.sql), so
-- dropping the role filter entirely and listing every profile is exactly
-- "everyone" the owner asked for. checkin_mark_servant_attendance already
-- has no role restriction of its own (just `exists (select 1 from
-- profiles where id = p_servant_id)`), so this list filter was the only
-- place anyone was actually being excluded.

create or replace function checkin_list_servants(p_token uuid)
returns table (id uuid, full_name text, kind text)
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
begin
  select (q.group_id is null) into v_is_servant_qr
  from qr_codes q where q.check_in_token = p_token;

  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  return query
    with combined as (
      select p.id as p_id, p.full_name as p_full_name, 'servant'::text as p_kind
      from profiles p
      union all
      select ps.id as p_id, ps.full_name as p_full_name, 'pending'::text as p_kind
      from pending_servants ps
      where ps.resulting_profile_id is null
    )
    select c.p_id, c.p_full_name, c.p_kind from combined c order by c.p_full_name;
end;
$$;

revoke all on function checkin_list_servants(uuid) from public;
grant execute on function checkin_list_servants(uuid) to anon, authenticated;

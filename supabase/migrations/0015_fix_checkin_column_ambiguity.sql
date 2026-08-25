-- 0015_fix_checkin_column_ambiguity.sql
-- Fixes "column reference is ambiguous" (42702) in checkin_get_flow: a
-- function with RETURNS TABLE(...) implicitly declares each output column
-- name as a PL/pgSQL variable throughout the function body -- flow_type
-- (an output column) collided with qr_codes.flow_type (a real table
-- column) the moment the body referenced it unqualified. Same latent risk
-- existed in checkin_list_servants (output columns id/full_name), fixed
-- here too even though it hadn't been hit yet. Fix: qualify every column
-- reference with its source table's alias, never bare.

create or replace function checkin_get_flow(p_token uuid)
returns table (is_servant boolean, flow_type qr_flow_type, label text)
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_flow     qr_flow_type;
  v_label    text;
  v_found    boolean;
begin
  select q.group_id, q.flow_type, true into v_group_id, v_flow, v_found
  from qr_codes q where q.check_in_token = p_token;

  if not coalesce(v_found, false) then
    raise exception 'Invalid check-in code';
  end if;

  if v_group_id is null then
    v_label := 'Servants';
  else
    select g.name into v_label from groups g where g.id = v_group_id;
  end if;

  return query select (v_group_id is null), v_flow, v_label;
end;
$$;

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
      where exists (select 1 from user_roles ur where ur.user_id = p.id and ur.role = 'servant')
      union all
      select ps.id as p_id, ps.full_name as p_full_name, 'pending'::text as p_kind
      from pending_servants ps
      where ps.resulting_profile_id is null
    )
    select c.p_id, c.p_full_name, c.p_kind from combined c order by c.p_full_name;
end;
$$;

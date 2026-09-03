-- 0046_checkin_undo_attendance.sql
-- Owner-reported: self-check-in is a single tap on a name in a list -- a
-- mis-tap (wrong name, right next to the intended one) had no way to be
-- undone; the person would have to go find a servant to fix it manually.
--
-- Design (agreed in chat, not a confirm-before-every-tap dialog): the
-- success screen already shows "You're checked in, <Name>!" -- that's
-- effectively an implicit confirmation, since a mis-tap's wrong name would
-- be immediately visible right there. The actual gap was just that there
-- was no way to undo it. Adds a "Not you? Undo" action on that screen
-- instead of adding friction to every single tap.
--
-- checkin_mark_*_attendance's boolean return used to mean only "is today a
-- tracked service day" (is_service_day() gate) -- `on conflict do nothing`
-- meant a call that hit an ALREADY-existing record (e.g. someone else
-- already checked this person in, or a coordinator marked it manually)
-- returned the exact same `true` as one that actually created a fresh row.
-- Undo must never remove a record it didn't itself just create, so each
-- function now also reports whether a row was newly inserted -- the client
-- only offers "Undo" when it was.
--
-- checkin_undo_*_attendance additionally only deletes a record created
-- within the last 2 minutes, as a server-side backstop independent of the
-- client's own judgment -- these are public, anonymous-callable functions
-- (no login on the check-in page), so undo can't be trusted to the client
-- alone; the recency window bounds it to "the tap that just happened",
-- never someone's attendance from earlier in the day.

-- ── checkin_mark_attendance: boolean -> table(attendance_recorded, newly_created) ──
drop function if exists checkin_mark_attendance(uuid, uuid);

create function checkin_mark_attendance(p_token uuid, p_member_id uuid)
returns table (attendance_recorded boolean, newly_created boolean)
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_flow     qr_flow_type;
  v_member_group uuid;
  v_is_visitor boolean;
  v_inserted_id uuid;
begin
  select group_id, flow_type into v_group_id, v_flow
  from qr_codes where check_in_token = p_token;

  if v_group_id is null then
    raise exception 'Invalid check-in code';
  end if;
  if v_flow <> 'check_in_and_intake' then
    raise exception 'This code does not support attendance check-in';
  end if;

  select group_id, is_visitor into v_member_group, v_is_visitor
  from members where id = p_member_id and status = 'active';

  if v_member_group is distinct from v_group_id then
    raise exception 'Member does not belong to this group';
  end if;

  if not is_service_day() then
    return query select false, false;
    return;
  end if;

  insert into attendance_records (attendee_type, member_id, service_date, is_visitor_at_time)
  values ('member', p_member_id, current_date, coalesce(v_is_visitor, false))
  on conflict (member_id, service_date) do nothing
  returning id into v_inserted_id;

  return query select true, (v_inserted_id is not null);
end;
$$;

revoke all on function checkin_mark_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_mark_servant_attendance: boolean -> table(attendance_recorded, newly_created) ──
drop function if exists checkin_mark_servant_attendance(uuid, uuid);

create function checkin_mark_servant_attendance(p_token uuid, p_servant_id uuid)
returns table (attendance_recorded boolean, newly_created boolean)
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
  v_inserted_id uuid;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes q where q.check_in_token = p_token;

  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  if not exists (select 1 from profiles where id = p_servant_id) then
    raise exception 'Servant not found';
  end if;

  if not is_service_day() then
    return query select false, false;
    return;
  end if;

  insert into attendance_records (attendee_type, servant_id, service_date)
  values ('servant', p_servant_id, current_date)
  on conflict (servant_id, service_date) do nothing
  returning id into v_inserted_id;

  return query select true, (v_inserted_id is not null);
end;
$$;

revoke all on function checkin_mark_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_servant_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_mark_pending_servant_attendance: boolean -> table(attendance_recorded, newly_created) ──
drop function if exists checkin_mark_pending_servant_attendance(uuid, uuid);

create function checkin_mark_pending_servant_attendance(p_token uuid, p_pending_servant_id uuid)
returns table (attendance_recorded boolean, newly_created boolean)
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
  v_inserted_id uuid;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes q where q.check_in_token = p_token;

  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  if not exists (select 1 from pending_servants where id = p_pending_servant_id and resulting_profile_id is null) then
    raise exception 'Pending servant not found';
  end if;

  if not is_service_day() then
    return query select false, false;
    return;
  end if;

  insert into pending_servant_attendance (pending_servant_id, service_date)
  values (p_pending_servant_id, current_date)
  on conflict (pending_servant_id, service_date) do nothing
  returning id into v_inserted_id;

  return query select true, (v_inserted_id is not null);
end;
$$;

revoke all on function checkin_mark_pending_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_mark_pending_servant_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_undo_attendance ──────────────────────────────────────────────
create function checkin_undo_attendance(p_token uuid, p_member_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_member_group uuid;
begin
  select group_id into v_group_id from qr_codes where check_in_token = p_token;
  if v_group_id is null then
    raise exception 'Invalid check-in code';
  end if;

  select group_id into v_member_group from members where id = p_member_id;
  if v_member_group is distinct from v_group_id then
    raise exception 'Member does not belong to this group';
  end if;

  delete from attendance_records
  where member_id = p_member_id
    and attendee_type = 'member'
    and service_date = current_date
    and created_at > now() - interval '2 minutes';
end;
$$;

revoke all on function checkin_undo_attendance(uuid, uuid) from public;
grant execute on function checkin_undo_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_undo_servant_attendance ──────────────────────────────────────
create function checkin_undo_servant_attendance(p_token uuid, p_servant_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes q where q.check_in_token = p_token;
  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  delete from attendance_records
  where servant_id = p_servant_id
    and attendee_type = 'servant'
    and service_date = current_date
    and created_at > now() - interval '2 minutes';
end;
$$;

revoke all on function checkin_undo_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_undo_servant_attendance(uuid, uuid) to anon, authenticated;

-- ── checkin_undo_pending_servant_attendance ──────────────────────────────
create function checkin_undo_pending_servant_attendance(p_token uuid, p_pending_servant_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_is_servant_qr boolean;
begin
  select (group_id is null) into v_is_servant_qr
  from qr_codes q where q.check_in_token = p_token;
  if not coalesce(v_is_servant_qr, false) then
    raise exception 'Invalid check-in code';
  end if;

  delete from pending_servant_attendance
  where pending_servant_id = p_pending_servant_id
    and service_date = current_date
    and created_at > now() - interval '2 minutes';
end;
$$;

revoke all on function checkin_undo_pending_servant_attendance(uuid, uuid) from public;
grant execute on function checkin_undo_pending_servant_attendance(uuid, uuid) to anon, authenticated;

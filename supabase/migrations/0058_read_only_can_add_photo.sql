-- 0058_read_only_can_add_photo.sql
-- Owner-clarified (Read-Only role bug follow-up): a Read-Only servant
-- should be able to ADD a photo to a member who doesn't have one yet, even
-- though they can't replace, remove, or edit anything else. members_update's
-- RLS (`using (has_group_access(group_id))`) excludes read_only entirely
-- (migration 0024/0057), so a plain `.update()` would still be blocked for
-- this narrow case too -- add_member_photo() is a security-definer RPC that
-- opens exactly this one exception: it only ever sets photo_path when it is
-- currently null, and still requires at least read-only visibility of the
-- member (has_readonly_or_full_group_access), so someone with no access to
-- this cohort at all still can't call it.
--
-- Schema-qualified from the start (current_schema() + `set search_path`,
-- the pattern migration 0043 introduced after photo uploads broke under
-- RLS the first time) rather than repeating that same mistake on a new
-- photo-related function.

do $$
declare
  v_schema text := current_schema();
begin
  execute format($outer$
    create or replace function %1$I.add_member_photo(p_member_id uuid, p_photo_path text)
    returns boolean
    language plpgsql
    security definer
    set search_path = %1$I, public
    as $fn$
      declare
        v_group_id uuid;
        v_rows int;
      begin
        select group_id into v_group_id from %1$I.members where id = p_member_id;
        if v_group_id is null then
          raise exception 'Member not found';
        end if;

        if not %1$I.has_readonly_or_full_group_access(v_group_id) then
          raise exception 'Not authorized to view this member';
        end if;

        update %1$I.members set photo_path = p_photo_path
        where id = p_member_id and photo_path is null;
        get diagnostics v_rows = row_count;

        return v_rows > 0;
      end;
    $fn$;
  $outer$, v_schema);

  execute format('revoke all on function %1$I.add_member_photo(uuid, text) from public', v_schema);
  execute format('grant execute on function %1$I.add_member_photo(uuid, text) to authenticated', v_schema);
end
$$;

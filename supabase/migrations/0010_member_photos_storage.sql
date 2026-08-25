-- 0010_member_photos_storage.sql
-- Member/servant photo storage -- same per-environment-bucket pattern as
-- 0009's branding bucket (qa-photos / prod-photos via current_schema()).
--
-- Unlike branding (Admin-only write, since it's app-wide identity), any
-- recognized app user may upload a member's photo -- REQUIREMENTS.md §6.4
-- describes this as a normal part of managing a group's members, available
-- to whoever already has access to that member's data, not an admin-only
-- action. Read is public for simplicity (photos aren't sensitive data, and
-- this avoids needing to plumb auth into every <img> tag).

do $$
declare
  v_bucket text := current_schema() || '-photos';
begin
  insert into storage.buckets (id, name, public)
  values (v_bucket, v_bucket, true)
  on conflict (id) do nothing;

  execute format(
    'create policy %I on storage.objects for select using (bucket_id = %L)',
    v_bucket || '_select', v_bucket
  );
  execute format(
    'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and is_app_user())',
    v_bucket || '_insert', v_bucket
  );
  execute format(
    'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and is_app_user())',
    v_bucket || '_update', v_bucket
  );
  execute format(
    'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and is_app_user())',
    v_bucket || '_delete', v_bucket
  );
end
$$;

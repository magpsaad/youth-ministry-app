-- 0017_calendar_attachments_storage.sql
-- Service Calendar event attachments (§6.8) -- same per-environment-bucket
-- pattern as 0009 (branding) and 0010 (photos). Any app user may write
-- (event creation/editing is open to all servants, confirmed intentional).
-- Read is public for simplicity, matching photos/branding.

do $$
declare
  v_bucket text := current_schema() || '-calendar';
  v_schema text := current_schema();
begin
  insert into storage.buckets (id, name, public)
  values (v_bucket, v_bucket, true)
  on conflict (id) do nothing;

  execute format(
    'create policy %I on storage.objects for select using (bucket_id = %L)',
    v_bucket || '_select', v_bucket
  );
  execute format(
    'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and %I.is_app_user())',
    v_bucket || '_insert', v_bucket, v_schema
  );
  execute format(
    'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and %I.is_app_user())',
    v_bucket || '_update', v_bucket, v_schema
  );
  execute format(
    'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and %I.is_app_user())',
    v_bucket || '_delete', v_bucket, v_schema
  );
end
$$;

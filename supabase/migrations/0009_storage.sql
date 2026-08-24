-- 0009_storage.sql
-- Supabase Storage buckets are project-wide, not schema-scoped (same
-- situation as auth.users, DATABASE_SCHEMA.md §5) -- so this bucket is
-- named per-environment (qa-branding / prod-branding) using current_schema(),
-- same pattern as 0008_grants.sql, so this file stays reusable unmodified.
--
-- REQUIREMENTS.md §1.1 already anticipated this: separate buckets per
-- environment within the one shared Supabase project.

do $$
declare
  v_bucket text := current_schema() || '-branding';
begin
  insert into storage.buckets (id, name, public)
  values (v_bucket, v_bucket, true)
  on conflict (id) do nothing;

  -- Public read (branding must render on the login screen and public QR
  -- pages, both reachable with no session -- same reasoning as app_settings
  -- and universities in 0007_rls_policies.sql).
  execute format(
    'create policy %I on storage.objects for select using (bucket_id = %L)',
    v_bucket || '_select', v_bucket
  );

  -- Only Admins may upload/replace branding assets.
  execute format(
    'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and is_admin())',
    v_bucket || '_insert', v_bucket
  );
  execute format(
    'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and is_admin())',
    v_bucket || '_update', v_bucket
  );
end
$$;

-- 0012_fix_storage_policy_search_path.sql
-- Fixes photo upload failing with "SQL function is_app_user() ... schema
-- mismatch": 0009/0010's storage.objects policies call is_admin()/
-- is_app_user() unqualified. Unlike PostgREST (which sets search_path to
-- qa/prod per request, so members/groups/etc. RLS resolves fine), Supabase's
-- Storage service runs its own fixed search_path that never includes the
-- app's schema -- so those unqualified calls can never resolve for it, even
-- though the same functions work everywhere else. Fix: bake the schema name
-- into the policy text at CREATE POLICY time (via current_schema(), captured
-- while this migration itself runs with the right schema on the search
-- path), so resolution no longer depends on the caller's search_path at all.

do $$
declare
  v_schema text := current_schema();
  v_branding text := v_schema || '-branding';
  v_photos text := v_schema || '-photos';
begin
  drop policy if exists "qa-branding_insert" on storage.objects;
  drop policy if exists "qa-branding_update" on storage.objects;
  drop policy if exists "prod-branding_insert" on storage.objects;
  drop policy if exists "prod-branding_update" on storage.objects;
  drop policy if exists "qa-photos_insert" on storage.objects;
  drop policy if exists "qa-photos_update" on storage.objects;
  drop policy if exists "qa-photos_delete" on storage.objects;
  drop policy if exists "prod-photos_insert" on storage.objects;
  drop policy if exists "prod-photos_update" on storage.objects;
  drop policy if exists "prod-photos_delete" on storage.objects;

  execute format(
    'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and %I.is_admin())',
    v_branding || '_insert', v_branding, v_schema
  );
  execute format(
    'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and %I.is_admin())',
    v_branding || '_update', v_branding, v_schema
  );

  execute format(
    'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and %I.is_app_user())',
    v_photos || '_insert', v_photos, v_schema
  );
  execute format(
    'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and %I.is_app_user())',
    v_photos || '_update', v_photos, v_schema
  );
  execute format(
    'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and %I.is_app_user())',
    v_photos || '_delete', v_photos, v_schema
  );
end
$$;

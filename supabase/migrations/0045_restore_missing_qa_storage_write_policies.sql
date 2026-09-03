-- 0045_restore_missing_qa_storage_write_policies.sql
-- Real root cause of the persistent photo-upload RLS failure, found by
-- directly inspecting pg_policies (owner-run diagnostic query): qa-photos
-- and qa-branding were missing their insert/update/delete policies
-- entirely, while prod had the complete set of all seven policies.
--
-- storage.objects is one single project-wide table -- its policies for
-- BOTH environments live in the same pg_policies list, not duplicated per
-- schema. 0012_fix_storage_policy_search_path.sql's `drop policy`
-- statements are hardcoded to drop both the "qa-*" and "prod-*" named
-- policies every time it runs, but its `create policy` statements only
-- rebuild the CURRENT schema's own 5 (current_schema()-derived). Running
-- 0012 in qa, then again in prod (the normal "run every migration in both
-- environments" workflow) means the prod run's drops silently wiped out
-- the qa policies the first run had just created, and only rebuilt prod's
-- -- leaving qa permanently missing its write policies afterward. Not a
-- search_path problem after all (confirmed live: qa.is_app_user() and its
-- callers all resolve and evaluate correctly via a real test account) --
-- purely this asymmetric drop-both/create-one-only bug in 0012 itself.
--
-- This only touches the 5 "qa-*" named policies -- it never drops or
-- references anything "prod-*", so it can't repeat 0012's mistake, and
-- hardcodes qa.is_app_user()/qa.is_admin() directly rather than deriving
-- the schema from current_schema()/search_path at all, so it doesn't
-- matter what search_path happens to be set to when this runs. prod is
-- already correct (confirmed by the same diagnostic query) -- do NOT
-- run this file against prod, and do NOT re-run 0012 in either
-- environment (it would just reproduce this same bug again).

drop policy if exists "qa-photos_insert" on storage.objects;
create policy "qa-photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'qa-photos' and qa.is_app_user());

drop policy if exists "qa-photos_update" on storage.objects;
create policy "qa-photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'qa-photos' and qa.is_app_user());

drop policy if exists "qa-photos_delete" on storage.objects;
create policy "qa-photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'qa-photos' and qa.is_app_user());

drop policy if exists "qa-branding_insert" on storage.objects;
create policy "qa-branding_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'qa-branding' and qa.is_admin());

drop policy if exists "qa-branding_update" on storage.objects;
create policy "qa-branding_update" on storage.objects for update to authenticated
  using (bucket_id = 'qa-branding' and qa.is_admin());

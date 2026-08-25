-- 0013_pin_search_path_on_role_functions.sql
-- Real fix for the photo-upload "is_app_user" failure (Postgres log showed
-- the actual cause: `relation "user_roles" does not exist`, 42P01).
--
-- 0012 schema-qualified the *call site* (qa.is_app_user() in the storage
-- policies), which was necessary but not sufficient: these functions'
-- own bodies also reference `user_roles` unqualified. Postgres inlines
-- these simple `language sql` functions into the calling query, and that
-- inlined body's unqualified `user_roles` reference gets resolved using
-- the CALLER's search_path (Storage's, pinned to `storage` only) rather
-- than the schema the function was created in -- so the same problem
-- existed one level down, just for a different identifier.
--
-- The correct, permanent fix (and standard practice for any SECURITY
-- DEFINER function, independent of this bug) is to pin each function's own
-- search_path at the function level, so its behavior never depends on
-- whichever role/context happens to call it.

do $$
declare
  v_schema text := current_schema();
begin
  execute format('alter function %I.is_admin_or_general_coordinator(uuid) set search_path = %I, public', v_schema, v_schema);
  execute format('alter function %I.is_admin(uuid) set search_path = %I, public', v_schema, v_schema);
  execute format('alter function %I.has_group_access(uuid, uuid) set search_path = %I, public', v_schema, v_schema);
  execute format('alter function %I.can_manage_servants(uuid) set search_path = %I, public', v_schema, v_schema);
  execute format('alter function %I.is_app_user(uuid) set search_path = %I, public', v_schema, v_schema);
end
$$;

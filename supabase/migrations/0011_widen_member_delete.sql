-- 0011_widen_member_delete.sql
-- REQUIREMENTS.md §3.3.1 originally restricted permanent member deletion to
-- Admins only. Owner requested widening this to General Coordinators too
-- (servants explicitly excluded -- the delete button should not even be
-- visible to them in the UI, enforced here regardless).

drop policy if exists members_delete on members;

create policy members_delete on members for delete
  using (is_admin_or_general_coordinator());

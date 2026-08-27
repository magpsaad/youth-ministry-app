-- 0025_audit_log_archive.sql
-- REQUIREMENTS.md §3.11/§6.14 -- 0007's own comment on audit_log flagged
-- this: "the log is append-only outside of the admin archive-by-age tool,
-- which should use the service role, not end-user RLS." There's no separate
-- delete policy at all -- this security-definer RPC IS that "service role"
-- style privileged path, gated to Admins, rather than a table-level grant
-- any authenticated user's session could reach.

create or replace function archive_audit_log(cutoff_date date)
returns integer language plpgsql security definer as $$
declare
  v_deleted integer;
begin
  if not is_admin() then
    raise exception 'Only Admins can archive audit log entries';
  end if;

  delete from audit_log where occurred_at < cutoff_date;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function archive_audit_log(date) to authenticated;

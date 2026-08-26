-- 0018_mark_qr_code_printed.sql
-- "Mark as Printed" needs printed_at to be set from the SAME clock/moment
-- the qr_codes updated_at trigger uses for its own now() -- computing
-- printed_at in application code (JS Date.now()) would always end up
-- microseconds earlier than the trigger's Postgres-side now() (network
-- round trip), making "needs reprint" (updated_at > printed_at) never
-- actually clear after marking printed. This function lets Postgres set
-- both from its own single transaction timestamp.

create or replace function mark_qr_code_printed(p_id uuid)
returns void
language sql
security definer
as $$
  update qr_codes set printed_at = now() where id = p_id;
$$;

revoke all on function mark_qr_code_printed(uuid) from public;
grant execute on function mark_qr_code_printed(uuid) to authenticated;

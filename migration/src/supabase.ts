import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/** Service-role client, scoped to the target schema (qa/prod) via db.schema
 * -- same mechanism the app itself uses (see web/src/lib/supabase/server.ts),
 * bypasses RLS since it uses the service role key, and can call the Auth
 * admin API (createUser etc.) which the app's own clients never do. */
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  db: { schema: config.schema },
  auth: { autoRefreshToken: false, persistSession: false },
});

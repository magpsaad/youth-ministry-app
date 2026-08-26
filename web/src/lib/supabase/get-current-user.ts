import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * React.cache()-memoized per request. The group layout, its child page (and
 * anything else rendered in the same request) all need "who's signed in?",
 * and every independent `supabase.auth.getUser()` call is a real network
 * round trip to Supabase's Auth server (unlike `getSession()`, which just
 * decodes the JWT locally, without server verification) -- proxy.ts's
 * middleware already does one such round trip per request to refresh the
 * session; before this, the layout and its page were each doing their own
 * on top of that, tripling the auth-network cost of every single
 * navigation for no benefit, since it's the same session being re-checked
 * moments apart. Caching collapses every call site within one render tree
 * into a single network hit.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

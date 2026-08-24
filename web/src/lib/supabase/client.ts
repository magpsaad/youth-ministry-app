import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components.
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the environment.
 *
 * Targets the `qa` or `prod` Postgres schema per NEXT_PUBLIC_APP_ENV (REQUIREMENTS.md
 * §1.1 -- one Supabase project, two schemas). Without this, PostgREST defaults to
 * `public`, where none of our tables live.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: process.env.NEXT_PUBLIC_APP_ENV as "qa" | "prod" },
    },
  );
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Route Handlers, and Server Actions.
 * Reads/writes the auth session via Next.js cookies.
 *
 * Targets the `qa` or `prod` Postgres schema per NEXT_PUBLIC_APP_ENV (REQUIREMENTS.md
 * §1.1 -- one Supabase project, two schemas). Without this, PostgREST defaults to
 * `public`, where none of our tables live.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: process.env.NEXT_PUBLIC_APP_ENV as "qa" | "prod" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component; safe to ignore
            // when middleware is refreshing the session.
          }
        },
      },
    },
  );
}

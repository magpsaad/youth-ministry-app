# Youth Ministry Management App — Web

Next.js (App Router, TypeScript, Tailwind) frontend for the Youth Ministry Management App. See the repo root `README.md` for the overall project layout, and `REQUIREMENTS.md` / `DATABASE_SCHEMA.md` for the functional and database specs this app implements.

## Environments

This app talks to a Supabase project shared by two environments — a `qa` Postgres schema and a `prod` Postgres schema (see `REQUIREMENTS.md` §1.1). Which one this deployment targets is controlled by `NEXT_PUBLIC_APP_ENV` in the environment variables (`qa` or `prod`), read by `src/lib/supabase/client.ts` and `server.ts`.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.local.example` to `.env.local` and fill in the Supabase project URL and Publishable Key before running — see `SETUP_INSTRUCTIONS.md` at the repo root.

Open [http://localhost:3000](http://localhost:3000) to view it.

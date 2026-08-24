# Youth Ministry Management App

Rebuild of the "St Arsanius Youth Ministry" (SAY Ministry) app — from Google Apps Script/Sheets to Next.js + Supabase, hosted free on Vercel. See `REQUIREMENTS.md` (functional spec) and `DATABASE_SCHEMA.md` (database design) for the full picture — both are the approved, living source of truth for this project.

## Repo layout

```
├── REQUIREMENTS.md / .pdf       requirements doc — update this whenever behavior changes
├── DATABASE_SCHEMA.md / .pdf    database design doc — companion to the migrations below
├── SETUP_INSTRUCTIONS.md        step-by-step account setup (Supabase, Google OAuth, GitHub, Vercel)
├── supabase/
│   ├── README.md                how to apply the migrations, and why there are two schemas
│   └── migrations/               numbered, ordered SQL migration files
└── web/                          the Next.js application (this is what deploys to Vercel)
```

## Status

Phase 0 (project scaffolding + database migrations, as SQL, ready to apply) — in progress. Nothing has been deployed or run against a live database yet; see `SETUP_INSTRUCTIONS.md` for what needs to happen before that's possible.

## Working agreement

Whenever the app owner reports a bug or questions a decision in the rebuilt app: propose a plan → get approval → implement → update `REQUIREMENTS.md` (and `DATABASE_SCHEMA.md` if the schema changes) so they stay the current source of truth. The app's own version number (independent of Vercel's deployment history) starts at 4.0 — see `REQUIREMENTS.md` §13 for the versioning workflow.

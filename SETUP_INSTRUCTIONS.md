# Setup Instructions — Your Parallel Steps

These are the account-level steps only you can do (they're tied to your own logins). Everything here is free. Work through them in this order when you have time — nothing here is urgent, and I'll keep building the app in the meantime. Once you've done a step, just tell me and I'll pick up from there (e.g. wire the app to the Supabase keys, push the code to GitHub, etc.).

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in with your existing account (the one that already has your other active project).
2. Click **New Project**.
3. Pick your organization, name it something like `youth-ministry-app`, and set a **strong database password** — save that password somewhere safe (a password manager). You won't need to give it to me; the app connects using separate API keys, not this password.
4. Pick a region close to your users, and create the project (takes about 2 minutes to provision).
5. Once it's ready, go to **Project Settings → API Keys**. You'll see a **Project URL** and a **Publishable Key** (Supabase's current name for what used to be called the "anon/public key" — same thing, safe to expose in browser code) — leave this tab open, you'll need both in step 3 below. Don't use the **Secret Key** (formerly "service_role") for anything in this app — that one must stay private.

## 2. Create the `qa` schema and apply the migrations

(Not `README.md` at the repo root — that one's just the folder map. The actual database steps live in **`supabase/README.md`**, a separate file inside the `supabase` folder.)

1. In your Supabase project dashboard, click **SQL Editor** in the left sidebar, then **New query**.
2. Paste this and click **Run** — creates the schema:
   ```sql
   create schema if not exists qa;
   ```
3. Open `supabase/migrations/0001_extensions_and_types.sql` in this repo. Copy its entire contents. In the SQL Editor, start a **new query**, and paste in this order: first the line `set search_path to qa;`, then the file's contents underneath it. Click **Run**.
4. Repeat step 3 for each remaining file, **in order**: `0002_core_tables.sql`, `0003_roles_and_access.sql`, `0004_operational_tables.sql`, `0005_config_tables.sql`, `0006_functions.sql`, `0007_rls_policies.sql`, `0008_grants.sql`. Each time: new query, `set search_path to qa;` first, then that file's contents, then Run. (The `set search_path` line has to be included every time, in every new query — it doesn't automatically carry over from one Run to the next.)
5. If any file gives an error, **stop there** and send me the exact error message plus which file number — don't continue past it or try to guess a fix, since later files depend on earlier ones having succeeded.
6. Once all 8 have run without error, verify everything landed in the right place — new query:
   ```sql
   set search_path to qa;
   select table_name from information_schema.tables where table_schema = 'qa' order by table_name;
   ```
   You should see 14 tables listed (`app_settings`, `attendance_records`, `audit_config`, `audit_log`, `groups`, `members`, `outreach_entries`, `profiles`, `qr_codes`, `service_calendar_events`, `universities`, `user_roles`, `verses`, plus `actions_needed_config`).
7. Go to **Project Settings → API → Exposed schemas** and add `qa` to the list (it's not exposed by default — only `public` is).

(We'll repeat this for a `prod` schema later, once QA is verified — no need to do that yet.)

## 3. Hand me the QA connection details

Once steps 1–2 are done, create a file at `web/.env.local` (copy `web/.env.local.example` as a starting point) with:
```
NEXT_PUBLIC_SUPABASE_URL=<your project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your Publishable Key>
NEXT_PUBLIC_APP_ENV=qa
```
That file is already gitignored, so it's safe to fill in locally — just let me know it's done and I'll pick up from there. (If you'd rather I fill it in directly, you can paste the URL and Publishable Key to me — that key is meant to be public-safe, not a secret — but never share the database password or the Secret Key with anyone, including me, in chat.)

## 4. Set up Google Sign-In (Google OAuth)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or reuse one you're comfortable dedicating to this) — name it something like `Youth Ministry App`.
3. Go to **APIs & Services → OAuth consent screen**. Choose **External**, fill in the app name, your support email, and save.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**. Application type: **Web application**.
5. Under **Authorized redirect URIs**, add:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   (`<your-project-ref>` is the subdomain in your Supabase Project URL from step 1 — e.g. if your URL is `https://abcdefgh.supabase.co`, the ref is `abcdefgh`.)
6. Create it, then copy the **Client ID** and **Client Secret**.
7. In the Supabase Dashboard, go to **Authentication → Providers → Google**, enable it, and paste in the Client ID and Client Secret.

## 5. Create a GitHub repository

1. Go to [github.com/new](https://github.com/new) and create a new **private** repository (e.g. `youth-ministry-app`) — don't initialize it with a README, license, or .gitignore (this repo already has all of that).
2. Send me the repository URL (e.g. `https://github.com/yourusername/youth-ministry-app.git`) and I'll connect this local repo to it and push the code, with your go-ahead.

## 6. Set up Vercel (two projects — Production and QA)

1. Go to [vercel.com](https://vercel.com) and sign up/log in — **"Continue with GitHub"** is the easiest option, since it auto-connects your account.
2. Once the GitHub repo from step 5 exists and has code pushed to it (I'll let you know when that's ready), come back and click **Add New → Project**, then import that repo — **twice**, as two separate Vercel projects:
   - **Project 1 — Production**: name it e.g. `youth-ministry-app`. Set **Root Directory** to `web`. Set it to track the `main` branch. Add environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same values as QA — same Supabase project), and `NEXT_PUBLIC_APP_ENV=prod`.
   - **Project 2 — QA**: name it e.g. `youth-ministry-app-qa`. Set **Root Directory** to `web`. Set it to track a `qa` branch (I'll create that branch once we're actively building). Same Supabase URL/key, but `NEXT_PUBLIC_APP_ENV=qa`.
3. Each project gets its own free `*.vercel.app` URL automatically — no custom domain needed yet.

---

## Summary of what I need from you as you go

- [ ] Supabase project created (step 1)
- [ ] `qa` schema created and migrations applied (step 2)
- [ ] QA Supabase URL + Publishable Key available (for `.env.local`, step 3)
- [ ] Google OAuth client set up and pasted into Supabase (step 4)
- [ ] GitHub repo URL (step 5)
- [ ] Two Vercel projects created and env vars set (step 6)

No rush on any of it — I'll keep working on the app itself (Phase 0 scaffolding is already underway) and pick up each piece as you complete it.

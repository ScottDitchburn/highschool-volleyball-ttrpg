# Supabase — optional cloud saves

The builder works entirely offline (localStorage autosave + JSON export). Cloud
saves are **additive**: when the two environment variables below are absent the
Cloud control is hidden and nothing in the app changes.

## 1. Create the project

1. Create a Supabase project (any region). Note its **Project URL** and
   **publishable (anon) key** from *Project Settings → API keys*.
2. These two values are the only credentials the client needs. They are designed
   to be shipped in front-end code — all access is gated by Row Level Security.
   **Never** put the service-role key in this app.

## 2. Apply the migration

`supabase/migrations/0001_cloud_characters.sql` is plain SQL and re-runnable.

Either paste it into the **SQL Editor** in the dashboard and run it, or use the
CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies everything in supabase/migrations
```

It creates:

| Object                     | What it is                                                       |
| -------------------------- | ---------------------------------------------------------------- |
| `public.profiles`          | Discord username + avatar per user, filled by a trigger on `auth.users` |
| `public.characters`        | One row per saved character (`data` jsonb + `schema_version`)      |
| `public.public_characters` | `security_invoker` view of characters with `is_public = true`, joined to the owner's username |

Row Level Security is enabled on both tables:

* owners may `select` / `insert` / `update` / `delete` only rows where
  `owner_id = auth.uid()` (insert is enforced with a `WITH CHECK`);
* **anyone**, signed in or not, may `select` rows where `is_public = true`;
* profiles are readable by everyone and writable only by their owner.

Requires PostgreSQL 15+ for `security_invoker` views — every current Supabase
project qualifies.

## 3. Configure Discord auth

In the Supabase dashboard:

1. **Authentication → Providers → Discord**: enable it and paste the **Client ID**
   and **Client Secret** from a Discord application
   (<https://discord.com/developers/applications> → your app → OAuth2).
2. Copy the callback URL Supabase shows you
   (`https://<project-ref>.supabase.co/auth/v1/callback`) into the Discord app's
   **OAuth2 → Redirects** list.
3. **Authentication → URL Configuration**:
   * **Site URL**: `https://washioisbae.vercel.app`
   * **Redirect URLs** (one per line — wildcards are supported):
     * `https://washioisbae.vercel.app/**`
     * `https://*.vercel.app/**` — Vercel preview deployments
     * `http://localhost:5173/**` — local `npm run dev`

   The app calls `signInWithOAuth` with `redirectTo` set to the current
   origin + pathname, so every origin a user might sign in from must be listed
   here or Supabase will bounce them to the Site URL.

No other provider is enabled — sign-in is Discord only, by design.

## 4. Point the app at the project

Copy `.env.example` to `.env.local` (git-ignored) and fill in:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable / anon key>
```

For the deployed site, add the same two variables in **Vercel → Project →
Settings → Environment Variables** (Production *and* Preview), then redeploy.
Vite inlines `VITE_*` variables at build time, so a redeploy is required for a
change to take effect.

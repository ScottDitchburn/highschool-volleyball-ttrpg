-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_cloud_characters.sql
-- Optional cloud persistence for the Haikyū: Gauntlet builder.
--
--   public.profiles          — one row per auth user (Discord username + avatar)
--   public.characters        — unlimited saved characters, each optionally public
--   public.public_characters — read-only view of the public ones (anon friendly)
--
-- Safe to re-run: every object is created with `if not exists` / `or replace`
-- and every policy is dropped before being recreated.
-- Requires PostgreSQL 15+ for the `security_invoker` view option (all current
-- Supabase projects qualify).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── shared helpers ───────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ─────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text,
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public display info (Discord username / avatar) for each signed-in user.';

-- Copy whatever Discord handed us into the profile row. Discord claims land in
-- raw_user_meta_data under varying keys depending on the account, so try them in
-- order of preference: display name → global name → login handle → name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  nick   text;
  avatar text;
begin
  nick := nullif(coalesce(
    meta ->> 'full_name',
    meta #>> '{custom_claims,global_name}',
    meta ->> 'user_name',
    meta ->> 'preferred_username',
    meta ->> 'name'
  ), '');
  avatar := nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), '');

  insert into public.profiles (id, username, avatar_url)
  values (new.id, nick, avatar)
  on conflict (id) do update
    set username   = coalesce(excluded.username,   public.profiles.username),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile in step when Discord sends fresh metadata on a later sign-in.
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

-- Backfill for users that already exist when this migration is applied.
insert into public.profiles (id, username, avatar_url)
select
  u.id,
  nullif(coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data #>> '{custom_claims,global_name}',
    u.raw_user_meta_data ->> 'user_name',
    u.raw_user_meta_data ->> 'preferred_username',
    u.raw_user_meta_data ->> 'name'
  ), ''),
  nullif(coalesce(
    u.raw_user_meta_data ->> 'avatar_url',
    u.raw_user_meta_data ->> 'picture'
  ), '')
from auth.users u
on conflict (id) do nothing;

-- ── characters ───────────────────────────────────────────────────────────────

create table if not exists public.characters (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  is_public      boolean not null default false,
  schema_version integer not null,
  data           jsonb not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.characters is
  'One row per saved character. `data` is the builder''s Character JSON, versioned by schema_version.';

create index if not exists characters_owner_id_idx
  on public.characters (owner_id, updated_at desc);

create index if not exists characters_public_idx
  on public.characters (updated_at desc)
  where is_public;

drop trigger if exists characters_touch_updated_at on public.characters;
create trigger characters_touch_updated_at
  before update on public.characters
  for each row execute function public.touch_updated_at();

-- ── row level security ───────────────────────────────────────────────────────

alter table public.profiles   enable row level security;
alter table public.characters enable row level security;

-- profiles: world-readable (public character lists show the owner's name),
-- writable only by the owner.
drop policy if exists profiles_select_all on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_all on public.profiles
  for select to anon, authenticated
  using (true);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- characters: owners get full CRUD over their own rows; everyone (including
-- signed-out visitors) may read rows flagged public.
drop policy if exists characters_select_own    on public.characters;
drop policy if exists characters_select_public on public.characters;
drop policy if exists characters_insert_own    on public.characters;
drop policy if exists characters_update_own    on public.characters;
drop policy if exists characters_delete_own    on public.characters;

create policy characters_select_own on public.characters
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy characters_select_public on public.characters
  for select to anon, authenticated
  using (is_public);

create policy characters_insert_own on public.characters
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy characters_update_own on public.characters
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy characters_delete_own on public.characters
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ── public browse view ───────────────────────────────────────────────────────
-- security_invoker = on means the view is still filtered by the policies above,
-- so it can never leak a private row even though it is granted to anon.

create or replace view public.public_characters
with (security_invoker = on) as
select
  c.id,
  c.owner_id,
  c.name,
  p.username as owner_username,
  c.schema_version,
  c.data,
  c.created_at,
  c.updated_at
from public.characters c
left join public.profiles p on p.id = c.owner_id
where c.is_public;

comment on view public.public_characters is
  'Public characters plus their owner''s display name. Read-only, anon-readable.';

grant select on public.public_characters to anon, authenticated;

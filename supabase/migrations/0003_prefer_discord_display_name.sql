-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_prefer_discord_display_name.sql
-- Discord puts the login handle in raw_user_meta_data.full_name and the
-- display name in custom_claims.global_name. Prefer the display name for
-- profiles.username so public lists show "Scooter" rather than the handle.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

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
    meta #>> '{custom_claims,global_name}',
    meta ->> 'full_name',
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

-- create or replace resets grants on some PG versions; re-apply the 0002 hardening.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Resync existing profiles with the new preference.
update public.profiles p
set username = nullif(coalesce(
      u.raw_user_meta_data #>> '{custom_claims,global_name}',
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'user_name',
      u.raw_user_meta_data ->> 'preferred_username',
      u.raw_user_meta_data ->> 'name'
    ), '')
from auth.users u
where u.id = p.id;

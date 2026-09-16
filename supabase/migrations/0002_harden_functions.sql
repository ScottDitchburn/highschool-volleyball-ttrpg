-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_harden_functions.sql
-- Address Supabase security advisor findings on the 0001 objects:
--   * handle_new_user() is a SECURITY DEFINER trigger function and must not be
--     callable through the REST RPC endpoint by anon / authenticated users.
--     Triggers keep firing: fire-time execution does not require EXECUTE.
--   * touch_updated_at() gets a pinned search_path.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

alter function public.touch_updated_at() set search_path = public;

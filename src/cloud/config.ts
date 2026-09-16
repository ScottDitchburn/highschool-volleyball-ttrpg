// ─────────────────────────────────────────────────────────────────────────────
// Cloud config — the two build-time env vars that switch cloud saves on.
//
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY
//
// Both are safe in client code (the publishable / anon key only reaches the
// database through Row Level Security). There is deliberately no service-role
// handling anywhere in this app.
// ─────────────────────────────────────────────────────────────────────────────

function readEnv(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string {
  // import.meta.env is statically replaced by Vite; guard anyway so the module
  // is importable from a plain node context (vitest `environment: 'node'`).
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  return (env[key] ?? '').trim();
}

/** Supabase project URL, or '' when cloud saves are not configured. */
export function cloudUrl(): string {
  return readEnv('VITE_SUPABASE_URL');
}

/** Supabase publishable (anon) key, or '' when cloud saves are not configured. */
export function cloudPublishableKey(): string {
  return readEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
}

/**
 * True only when BOTH variables are present. Every cloud entry point checks
 * this first; when it is false the UI renders nothing and no client is created.
 */
export function isCloudConfigured(): boolean {
  return cloudUrl() !== '' && cloudPublishableKey() !== '';
}

/** Dev builds show a muted "not configured" hint instead of hiding silently. */
export function isDevBuild(): boolean {
  const env = (import.meta.env ?? {}) as Record<string, unknown>;
  return env.DEV === true;
}

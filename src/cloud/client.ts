// ─────────────────────────────────────────────────────────────────────────────
// Cloud client — lazily created, null when unconfigured.
//
// `@supabase/supabase-js` is pulled in with a dynamic import so it lands in its
// own chunk: a build without VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
// never evaluates it and the main bundle is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { cloudUrl, cloudPublishableKey, isCloudConfigured } from './config';
import type { CloudClient } from './types';

let pending: Promise<CloudClient | null> | null = null;
let override: CloudClient | null = null;

/**
 * Resolve the shared client, creating it on first use.
 * Returns null when cloud saves are not configured, or when supabase-js could
 * not be loaded (offline / blocked CDN) — callers treat both as "no cloud".
 */
export async function getCloudClient(): Promise<CloudClient | null> {
  if (override) return override;
  if (!isCloudConfigured()) return null;

  if (!pending) {
    pending = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(cloudUrl(), cloudPublishableKey(), {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        }) as unknown as CloudClient,
      )
      .catch(() => null);
  }
  return pending;
}

/**
 * Test seam: install a fake client (or null to clear it) and drop any client
 * already created. Never called by application code.
 */
export function setCloudClientForTests(client: CloudClient | null): void {
  override = client;
  pending = null;
}

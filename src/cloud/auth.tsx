// ─────────────────────────────────────────────────────────────────────────────
// <CloudProvider> — makes the cloud session available to the whole app.
//
// Always safe to mount: with no VITE_SUPABASE_* env vars it creates no client,
// makes no request and simply hands down `configured: false`.
// The hook, context and helpers live in authContext.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';
import { CloudAuthContext, useProvideCloudAuth } from './authContext';

export function CloudProvider({ children }: { children: ReactNode }) {
  const value = useProvideCloudAuth();
  return <CloudAuthContext.Provider value={value}>{children}</CloudAuthContext.Provider>;
}

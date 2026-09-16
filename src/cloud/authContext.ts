// ─────────────────────────────────────────────────────────────────────────────
// Cloud auth — context, hook and the session state machine.
//
// Kept apart from auth.tsx (which holds only the <CloudProvider> component) so
// neither file mixes component and non-component exports — the repo lints with
// react-refresh/only-export-components as an error.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCloudClient } from './client';
import { isCloudConfigured } from './config';
import { loadProfile } from './characters';
import type { CloudClient, CloudProfile, CloudSession } from './types';

export interface CloudAuthValue {
  /** False when the env vars are missing — the UI renders nothing at all. */
  configured: boolean;
  /** True until the first getSession() settles. */
  loading: boolean;
  session: CloudSession | null;
  userId: string | null;
  profile: CloudProfile | null;
  /** Best display name we have: profile → Discord metadata → 'Discord user'. */
  displayName: string | null;
  avatarUrl: string | null;
  client: CloudClient | null;
  error: string | null;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const CLOUD_AUTH_DEFAULT: CloudAuthValue = {
  configured: false,
  loading: false,
  session: null,
  userId: null,
  profile: null,
  displayName: null,
  avatarUrl: null,
  client: null,
  error: null,
  signInWithDiscord: async () => {},
  signOut: async () => {},
};

export const CloudAuthContext = createContext<CloudAuthValue>(CLOUD_AUTH_DEFAULT);

/**
 * Cloud session state. Outside a <CloudProvider> this returns the inert default
 * (configured: false), so any component may call it unconditionally.
 */
export function useCloudAuth(): CloudAuthValue {
  return useContext(CloudAuthContext);
}

// ── metadata helpers ─────────────────────────────────────────────────────────

function metaString(meta: Record<string, unknown> | undefined, key: string): string | null {
  const value = meta?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Discord's display name, wherever this account happens to carry it. */
export function displayNameFromSession(session: CloudSession | null): string | null {
  const meta = session?.user.user_metadata;
  const claims = meta?.custom_claims;
  const globalName =
    claims && typeof claims === 'object'
      ? metaString(claims as Record<string, unknown>, 'global_name')
      : null;
  return (
    metaString(meta, 'full_name') ??
    globalName ??
    metaString(meta, 'user_name') ??
    metaString(meta, 'preferred_username') ??
    metaString(meta, 'name') ??
    null
  );
}

export function avatarFromSession(session: CloudSession | null): string | null {
  const meta = session?.user.user_metadata;
  return metaString(meta, 'avatar_url') ?? metaString(meta, 'picture');
}

/** Where Discord should send the user back to after the OAuth round trip. */
export function currentRedirectTarget(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

// ── the state machine behind <CloudProvider> ─────────────────────────────────

export function useProvideCloudAuth(): CloudAuthValue {
  const configured = isCloudConfigured();
  const [client, setClient] = useState<CloudClient | null>(null);
  const [session, setSession] = useState<CloudSession | null>(null);
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<CloudClient | null>(null);

  // Create the client once, read the stored session, then follow auth events.
  useEffect(() => {
    if (!configured) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const resolved = await getCloudClient();
      if (!active) return;
      if (!resolved) {
        setLoading(false);
        setError('Cloud saves are unavailable right now.');
        return;
      }
      clientRef.current = resolved;
      setClient(resolved);

      try {
        const { data, error: sessionError } = await resolved.auth.getSession();
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        setSession(data?.session ?? null);
      } catch {
        if (active) setError('Could not check your sign-in status.');
      } finally {
        if (active) setLoading(false);
      }

      const listener = resolved.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next);
        setError(null);
      });
      unsubscribe = () => listener.data.subscription.unsubscribe();
    })();

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [configured]);

  // Profile row follows the session (it is written by a trigger on first sign-in).
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!client || !userId) {
      setProfile(null);
      return;
    }
    let active = true;
    void (async () => {
      const result = await loadProfile(client, userId);
      if (!active) return;
      if (result.ok) setProfile(result.value);
    })();
    return () => {
      active = false;
    };
  }, [client, userId]);

  return useMemo<CloudAuthValue>(() => {
    const signInWithDiscord = async () => {
      const active = clientRef.current ?? (await getCloudClient());
      if (!active) {
        setError('Cloud saves are unavailable right now.');
        return;
      }
      setError(null);
      try {
        const { error: oauthError } = await active.auth.signInWithOAuth({
          provider: 'discord',
          options: { redirectTo: currentRedirectTarget() },
        });
        if (oauthError) setError(oauthError.message);
      } catch {
        setError('Could not start the Discord sign-in.');
      }
    };

    const signOut = async () => {
      const active = clientRef.current;
      if (!active) return;
      try {
        const { error: signOutError } = await active.auth.signOut();
        if (signOutError) setError(signOutError.message);
      } catch {
        setError('Could not sign out.');
      }
      setSession(null);
      setProfile(null);
    };

    return {
      configured,
      loading,
      session,
      userId: session?.user.id ?? null,
      profile,
      displayName: profile?.username ?? displayNameFromSession(session),
      avatarUrl: profile?.avatarUrl ?? avatarFromSession(session),
      client,
      error,
      signInWithDiscord,
      signOut,
    };
  }, [configured, loading, session, profile, client, error]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud — the narrow slice of supabase-js this app actually uses.
//
// Everything below is a *structural* interface, not an import of the real
// client. Two reasons:
//   1. `@supabase/supabase-js` is loaded lazily (see client.ts) so the main
//      bundle stays unchanged when cloud saves are not configured;
//   2. the repository functions in characters.ts take a client as a parameter,
//      so tests can hand them a small hand-rolled fake with no network at all.
// ─────────────────────────────────────────────────────────────────────────────

export interface CloudError {
  message: string;
  code?: string;
}

export interface CloudResult<T> {
  data: T | null;
  error: CloudError | null;
}

/**
 * PostgREST-style chainable builder. Awaiting it yields rows; `.single()`
 * yields one row. Only the links this app uses are declared.
 */
export interface CloudQuery<T> extends PromiseLike<CloudResult<T[]>> {
  select(columns?: string): CloudQuery<T>;
  eq(column: string, value: unknown): CloudQuery<T>;
  order(column: string, options?: { ascending?: boolean }): CloudQuery<T>;
  limit(count: number): CloudQuery<T>;
  single(): PromiseLike<CloudResult<T>>;
  maybeSingle(): PromiseLike<CloudResult<T>>;
}

export interface CloudTable<T> {
  select(columns?: string): CloudQuery<T>;
  insert(values: Record<string, unknown>): CloudQuery<T>;
  update(values: Record<string, unknown>): CloudQuery<T>;
  delete(): CloudQuery<T>;
}

// ── auth ─────────────────────────────────────────────────────────────────────

export interface CloudUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface CloudSession {
  user: CloudUser;
}

export interface CloudSubscription {
  data: { subscription: { unsubscribe(): void } };
}

export interface CloudAuth {
  getSession(): PromiseLike<CloudResult<{ session: CloudSession | null }>>;
  onAuthStateChange(
    callback: (event: string, session: CloudSession | null) => void,
  ): CloudSubscription;
  signInWithOAuth(params: {
    provider: 'discord';
    options?: { redirectTo?: string };
  }): PromiseLike<CloudResult<unknown>>;
  signOut(): PromiseLike<{ error: CloudError | null }>;
}

export interface CloudClient {
  from<T = Record<string, unknown>>(table: string): CloudTable<T>;
  auth: CloudAuth;
}

// ── domain rows ──────────────────────────────────────────────────────────────

/** A row of `public.characters` (or `public.public_characters`). */
export interface CloudCharacterRow {
  id: string;
  owner_id?: string | null;
  name: string;
  is_public?: boolean;
  owner_username?: string | null;
  schema_version: number;
  data: unknown;
  created_at?: string;
  updated_at?: string;
}

/** What the list panels render — never the full character payload. */
export interface CloudCharacterSummary {
  id: string;
  name: string;
  isPublic: boolean;
  updatedAt: string | null;
  /** 1–3, or null when the payload is unreadable. `graduated` wins in the UI. */
  schoolYear: number | null;
  graduated: boolean;
  ownerUsername: string | null;
}

/** The signed-in user's display info, from `public.profiles`. */
export interface CloudProfile {
  id: string;
  username: string | null;
  avatarUrl: string | null;
}

/** Repository result — never throws, always says what went wrong. */
export type CloudOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

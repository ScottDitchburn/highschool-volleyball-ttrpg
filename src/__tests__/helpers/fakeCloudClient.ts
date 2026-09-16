// ─────────────────────────────────────────────────────────────────────────────
// A hand-rolled stand-in for the supabase-js client.
//
// Chainable like PostgREST (from → select/insert/update/delete → eq/order/limit
// → single), records every call so tests can assert on what was sent, and
// answers from a responder function. Nothing here touches the network.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CloudAuth,
  CloudClient,
  CloudQuery,
  CloudResult,
  CloudSession,
  CloudTable,
} from '../../cloud/types';

export interface FakeCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  columns?: string;
  values?: Record<string, unknown>;
  filters: Array<{ column: string; value: unknown }>;
  order?: { column: string; ascending: boolean };
  limit?: number;
  /** True when the caller asked for one row (`.single()` / `.maybeSingle()`). */
  single: boolean;
}

export type FakeResponder = (call: FakeCall) => CloudResult<unknown>;

export interface FakeDb {
  client: CloudClient;
  calls: FakeCall[];
}

const EMPTY: CloudResult<unknown> = { data: null, error: null };

/** A client whose queries are answered by `responder`. */
export function makeFakeDb(
  responder: FakeResponder = () => EMPTY,
  auth?: CloudAuth,
): FakeDb {
  const calls: FakeCall[] = [];

  function table<T>(name: string): CloudTable<T> {
    function build(op: FakeCall['op'], values?: Record<string, unknown>): CloudQuery<T> {
      const call: FakeCall = { table: name, op, values, filters: [], single: false };
      calls.push(call);

      const settle = (): Promise<CloudResult<T>> =>
        Promise.resolve(responder(call) as CloudResult<T>);

      const query = {
        select(columns?: string) {
          call.columns = columns;
          return query;
        },
        eq(column: string, value: unknown) {
          call.filters.push({ column, value });
          return query;
        },
        order(column: string, options?: { ascending?: boolean }) {
          call.order = { column, ascending: options?.ascending !== false };
          return query;
        },
        limit(count: number) {
          call.limit = count;
          return query;
        },
        single() {
          call.single = true;
          return settle();
        },
        maybeSingle() {
          call.single = true;
          return settle();
        },
        then<TResult1, TResult2>(
          onfulfilled?: ((value: CloudResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          return (settle() as unknown as Promise<CloudResult<T[]>>).then(onfulfilled, onrejected);
        },
      };

      return query as unknown as CloudQuery<T>;
    }

    return {
      select: (columns?: string) => build('select').select(columns),
      insert: (values: Record<string, unknown>) => build('insert', values),
      update: (values: Record<string, unknown>) => build('update', values),
      delete: () => build('delete'),
    };
  }

  const client: CloudClient = {
    from: <T,>(name: string) => table<T>(name),
    auth: auth ?? makeFakeAuth().auth,
  };

  return { client, calls };
}

// ── auth ─────────────────────────────────────────────────────────────────────

export interface FakeAuth {
  auth: CloudAuth;
  /** Push a session (or null) to every onAuthStateChange listener. */
  emit: (event: string, session: CloudSession | null) => void;
  signInCalls: Array<{ provider: string; redirectTo?: string }>;
  signOutCalls: number;
  unsubscribed: () => boolean;
}

export function makeFakeAuth(initial: CloudSession | null = null): FakeAuth {
  const listeners: Array<(event: string, session: CloudSession | null) => void> = [];
  const signInCalls: Array<{ provider: string; redirectTo?: string }> = [];
  let signOutCalls = 0;
  let unsubscribedFlag = false;

  const auth: CloudAuth = {
    getSession: () => Promise.resolve({ data: { session: initial }, error: null }),
    onAuthStateChange(callback) {
      listeners.push(callback);
      return {
        data: {
          subscription: {
            unsubscribe() {
              unsubscribedFlag = true;
            },
          },
        },
      };
    },
    signInWithOAuth(params) {
      signInCalls.push({ provider: params.provider, redirectTo: params.options?.redirectTo });
      return Promise.resolve({ data: null, error: null });
    },
    signOut() {
      signOutCalls += 1;
      return Promise.resolve({ error: null });
    },
  };

  return {
    auth,
    emit: (event, session) => listeners.forEach((l) => l(event, session)),
    signInCalls,
    get signOutCalls() {
      return signOutCalls;
    },
    unsubscribed: () => unsubscribedFlag,
  };
}

/** A signed-in session carrying Discord-shaped metadata. */
export function fakeSession(id = 'user-1', metadata: Record<string, unknown> = {}): CloudSession {
  return { user: { id, user_metadata: { full_name: 'Shoyo', ...metadata } } };
}

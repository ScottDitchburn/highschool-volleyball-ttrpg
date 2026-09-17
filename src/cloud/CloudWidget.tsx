// ─────────────────────────────────────────────────────────────────────────────
// CloudWidget — the "Cloud" control in the wizard top banner.
//
//   unconfigured            → nothing (a muted hint in dev builds)
//   configured, signed out  → "Sign in with Discord" (+ browse public saves)
//   signed in               → Discord name/avatar → menu with Save to cloud,
//                             My characters, Public characters, Bulk upload,
//                             Sign out
//
// Cloud storage is additive: localStorage autosave is untouched either way.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCharacter } from '../state/characterStore';
import { useCloudAuth } from './authContext';
import { isDevBuild } from './config';
import { useCloudSave } from './useCloudSave';
import { listMine, listPublic, load, remove, setPublic } from './characters';
import { bulkUpload, parseBulkFiles, type BulkItem, type BulkUploadOutcome } from './bulkImport';
import { shortDate, yearBadge } from './format';
import type { CloudCharacterSummary, CloudClient } from './types';
import type { Character } from '../types';
import { CHARACTERS_PATH, navigateTo, requestJumpToFurthestStep } from '../navigation';

type PanelView = 'menu' | 'mine' | 'public' | 'bulk';

// ── shared list plumbing ─────────────────────────────────────────────────────

interface ListState {
  loading: boolean;
  error: string | null;
  rows: CloudCharacterSummary[];
}

const EMPTY_LIST: ListState = { loading: true, error: null, rows: [] };

function RowShell({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-charcoal-800 bg-charcoal-900/60 p-2.5">
      {children}
    </li>
  );
}

function ListMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-charcoal-500 text-xs italic px-0.5">{children}</p>;
}

// ── My characters ────────────────────────────────────────────────────────────

function MyCharactersPanel({
  client,
  userId,
  onLoaded,
}: {
  client: CloudClient;
  userId: string;
  onLoaded: (loaded: Character) => void;
}) {
  const { character, dispatch } = useCharacter();
  const [list, setList] = useState<ListState>(EMPTY_LIST);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setList((prev) => ({ ...prev, loading: true, error: null }));
    const result = await listMine(client, userId);
    if (result.ok) setList({ loading: false, error: null, rows: result.value });
    else setList({ loading: false, error: result.error, rows: [] });
  }, [client, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleLoad = async (row: CloudCharacterSummary) => {
    if (!window.confirm(`Load "${row.name}"? This replaces the character you are building.`)) return;
    setBusyId(row.id);
    const result = await load(client, row.id, userId);
    setBusyId(null);
    if (!result.ok) {
      setList((prev) => ({ ...prev, error: result.error }));
      return;
    }
    dispatch({ type: 'IMPORT_CHARACTER', character: result.value });
    onLoaded(result.value);
  };

  const handleDelete = async (row: CloudCharacterSummary) => {
    if (!window.confirm(`Delete "${row.name}" from the cloud? This cannot be undone.`)) return;
    setBusyId(row.id);
    const result = await remove(client, row.id);
    setBusyId(null);
    if (!result.ok) {
      setList((prev) => ({ ...prev, error: result.error }));
      return;
    }
    if (character.cloudId === row.id) dispatch({ type: 'SET_CLOUD_ID', cloudId: null });
    setList((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== row.id) }));
  };

  const handleToggle = async (row: CloudCharacterSummary) => {
    const next = !row.isPublic;
    setBusyId(row.id);
    const result = await setPublic(client, row.id, next);
    setBusyId(null);
    if (!result.ok) {
      setList((prev) => ({ ...prev, error: result.error }));
      return;
    }
    setList((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === row.id ? { ...r, isPublic: next } : r)),
    }));
  };

  return (
    <div className="flex flex-col gap-2">
      {list.error && (
        <p className="text-red-400 text-xs" role="alert">
          {list.error}
        </p>
      )}
      {list.loading ? (
        <ListMessage>Loading your characters…</ListMessage>
      ) : list.rows.length === 0 ? (
        <ListMessage>No cloud characters yet — use “Save to cloud”.</ListMessage>
      ) : (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {list.rows.map((row) => (
            <RowShell key={row.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-charcoal-100 truncate">{row.name}</span>
                <span className="text-xs text-charcoal-500 shrink-0">
                  {yearBadge(row.schoolYear, row.graduated)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-charcoal-600">{shortDate(row.updatedAt)}</span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-charcoal-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={row.isPublic}
                      disabled={busyId === row.id}
                      onChange={() => void handleToggle(row)}
                      className="w-3.5 h-3.5 accent-orange-500"
                      aria-label={`Make ${row.name} public`}
                    />
                    Public
                  </label>
                  <button
                    type="button"
                    className="btn-ghost text-xs py-1 px-2"
                    disabled={busyId === row.id}
                    onClick={() => void handleLoad(row)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs py-1 px-2 text-red-400 hover:text-red-300"
                    disabled={busyId === row.id}
                    onClick={() => void handleDelete(row)}
                    aria-label={`Delete ${row.name}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </RowShell>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Public characters ────────────────────────────────────────────────────────

function PublicCharactersPanel({
  client,
  viewerId,
  onLoaded,
}: {
  client: CloudClient;
  viewerId: string | null;
  onLoaded: (loaded: Character) => void;
}) {
  const { dispatch } = useCharacter();
  const [list, setList] = useState<ListState>(EMPTY_LIST);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await listPublic(client);
      if (!active) return;
      if (result.ok) setList({ loading: false, error: null, rows: result.value });
      else setList({ loading: false, error: result.error, rows: [] });
    })();
    return () => {
      active = false;
    };
  }, [client]);

  const handleLoad = async (row: CloudCharacterSummary) => {
    if (!window.confirm(`Load a copy of "${row.name}"? This replaces the character you are building.`)) {
      return;
    }
    setBusyId(row.id);
    // viewerId is passed so your own public characters keep their cloud slot;
    // anyone else's arrive as a fresh, unsaved copy.
    const result = await load(client, row.id, viewerId);
    setBusyId(null);
    if (!result.ok) {
      setList((prev) => ({ ...prev, error: result.error }));
      return;
    }
    dispatch({ type: 'IMPORT_CHARACTER', character: result.value });
    onLoaded(result.value);
  };

  return (
    <div className="flex flex-col gap-2">
      {list.error && (
        <p className="text-red-400 text-xs" role="alert">
          {list.error}
        </p>
      )}
      {list.loading ? (
        <ListMessage>Loading public characters…</ListMessage>
      ) : list.rows.length === 0 ? (
        <ListMessage>Nobody has shared a character yet.</ListMessage>
      ) : (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {list.rows.map((row) => (
            <RowShell key={row.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-charcoal-100 truncate">{row.name}</span>
                <span className="text-xs text-charcoal-500 shrink-0">
                  {yearBadge(row.schoolYear, row.graduated)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-charcoal-500 truncate">
                  by {row.ownerUsername ?? 'unknown player'}
                  {row.updatedAt ? ` · ${shortDate(row.updatedAt)}` : ''}
                </span>
                <button
                  type="button"
                  className="btn-ghost text-xs py-1 px-2 shrink-0"
                  disabled={busyId === row.id}
                  onClick={() => void handleLoad(row)}
                >
                  Load copy
                </button>
              </div>
            </RowShell>
          ))}
        </ul>
      )}
    </div>
  );
}


// ── Bulk upload ──────────────────────────────────────────────────────────────

type BulkPhase =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'ready'; items: BulkItem[]; errors: string[] }
  | { status: 'uploading'; total: number; done: number; errors: string[] }
  | { status: 'done'; outcomes: BulkUploadOutcome[]; errors: string[] };

function BulkUploadPanel({
  client,
  userId,
  onViewMine,
}: {
  client: CloudClient;
  userId: string;
  onViewMine: () => void;
}) {
  const [phase, setPhase] = useState<BulkPhase>({ status: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setPhase({ status: 'reading' });
    const files = Array.from(list);
    const parsed = await parseBulkFiles(files);
    setPhase({ status: 'ready', items: parsed.items, errors: parsed.errors });
  };

  const handleUpload = async () => {
    if (phase.status !== 'ready' || phase.items.length === 0) return;
    const { items, errors } = phase;
    setPhase({ status: 'uploading', total: items.length, done: 0, errors });
    const outcomes = await bulkUpload(client, userId, items, (done, total) =>
      setPhase({ status: 'uploading', total, done, errors }),
    );
    setPhase({ status: 'done', outcomes, errors });
  };

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
    setPhase({ status: 'idle' });
  };

  const busy = phase.status === 'reading' || phase.status === 'uploading';
  const skipped = 'errors' in phase ? phase.errors : [];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-charcoal-400 text-xs leading-relaxed">
        Pick any number of saved JSON files: builder exports, coach backups (every
        player on the roster) or plain character objects. Each one becomes a new
        private character on your account. The character you are building is
        untouched.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-charcoal-300 text-xs font-semibold uppercase tracking-wider">
          Character files
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          disabled={busy}
          aria-label="Character files"
          onChange={(e) => void handleFiles(e.target.files)}
          className="text-xs text-charcoal-300 file:mr-3 file:rounded file:border file:border-charcoal-700
                     file:bg-charcoal-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold
                     file:text-orange-400 hover:file:border-orange-600 disabled:opacity-40"
        />
      </label>

      {phase.status === 'reading' && <ListMessage>Reading files…</ListMessage>}

      {phase.status === 'ready' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-charcoal-200" role="status">
            {phase.items.length === 0
              ? 'No characters found in the chosen files.'
              : `${phase.items.length} character${phase.items.length === 1 ? '' : 's'} ready to upload.`}
          </p>
          {phase.items.length > 0 && (
            <ul className="max-h-40 overflow-y-auto text-xs text-charcoal-400 flex flex-col gap-0.5 pr-1">
              {phase.items.map((item, i) => (
                <li key={`${item.source}-${i}`} className="flex justify-between gap-2">
                  <span className="truncate text-charcoal-200">{item.name}</span>
                  <span className="truncate text-charcoal-600">{item.source}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={phase.items.length === 0}
              className="btn-primary text-sm py-1.5 px-3 disabled:opacity-40"
            >
              Upload {phase.items.length > 0 ? phase.items.length : ''}
            </button>
            <button type="button" onClick={reset} className="btn-ghost text-sm py-1.5 px-3">
              Clear
            </button>
          </div>
        </div>
      )}

      {phase.status === 'uploading' && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-charcoal-200" role="status" aria-live="polite">
            Uploading {phase.done} of {phase.total}…
          </p>
          <div className="h-1.5 w-full rounded bg-charcoal-800 overflow-hidden" aria-hidden="true">
            <div
              className="h-full bg-orange-500 transition-[width]"
              style={{ width: `${phase.total === 0 ? 0 : Math.round((phase.done / phase.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {phase.status === 'done' && (
        <BulkSummary outcomes={phase.outcomes} onViewMine={onViewMine} onReset={reset} />
      )}

      {skipped.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-amber-400" role="alert">
            {skipped.length} {skipped.length === 1 ? 'entry was' : 'entries were'} skipped:
          </p>
          <ul className="max-h-32 overflow-y-auto text-xs text-charcoal-500 flex flex-col gap-0.5 pr-1">
            {skipped.map((msg, i) => (
              <li key={i} className="break-words">{msg}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BulkSummary({
  outcomes,
  onViewMine,
  onReset,
}: {
  outcomes: BulkUploadOutcome[];
  onViewMine: () => void;
  onReset: () => void;
}) {
  const uploaded = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.filter((o) => !o.ok);
  return (
    <div className="flex flex-col gap-2">
      <p className={`text-sm ${failed.length === 0 ? 'text-green-400' : 'text-charcoal-200'}`} role="status">
        {uploaded} uploaded{failed.length > 0 ? `, ${failed.length} failed` : ''}.
      </p>
      {failed.length > 0 && (
        <ul className="max-h-32 overflow-y-auto text-xs text-red-400 flex flex-col gap-0.5 pr-1">
          {failed.map((o, i) => (
            <li key={i} className="break-words">
              {o.item.name} ({o.item.source}): {o.error}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onViewMine} className="btn-ghost text-sm py-1.5 px-3">
          My characters
        </button>
        <button type="button" onClick={onReset} className="btn-ghost text-sm py-1.5 px-3">
          Upload more
        </button>
      </div>
    </div>
  );
}

// ── The banner control ───────────────────────────────────────────────────────

/** After a cloud character is loaded, make sure the builder shows the wizard. */
function announceLoaded(loaded: Character): void {
  // Fresh mount (landing page): the wizard reads this flag when it mounts.
  requestJumpToFurthestStep();
  // Already mounted: the wizard listens for the event and jumps using the
  // character carried in the detail (its own state may not have updated yet).
  window.dispatchEvent(new CustomEvent('haikyu:open-wizard', { detail: { character: loaded } }));
}

export function CloudWidget() {
  const auth = useCloudAuth();
  const { canSave, isUpdate, state: saveState, saveNow } = useCloudSave();
  const [view, setView] = useState<PanelView | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape, like the Information widget.
  useEffect(() => {
    if (view === null) return;
    function handlePointer(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setView(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setView(null);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [view]);

  if (!auth.configured) {
    // Nothing at all in production; a muted hint while developing so the missing
    // env vars are obvious rather than mysterious.
    return isDevBuild() ? (
      <span
        className="text-charcoal-700 text-xs hidden sm:inline"
        title="Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable cloud saves"
      >
        cloud saves not configured
      </span>
    ) : null;
  }

  const signedIn = auth.userId !== null;
  const label = auth.displayName ?? 'Discord user';

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      {signedIn ? (
        <button
          type="button"
          onClick={() => setView((v) => (v === null ? 'menu' : null))}
          aria-expanded={view !== null}
          aria-haspopup="dialog"
          className={`btn-ghost text-sm py-1.5 px-3 flex items-center gap-1.5 ${
            view !== null ? 'text-orange-400 border-orange-600' : ''
          }`}
          title="Cloud saves"
        >
          {auth.avatarUrl ? (
            <img src={auth.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
          ) : (
            <span aria-hidden="true">☁</span>
          )}
          <span className="max-w-[8rem] truncate">{label}</span>
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void auth.signInWithDiscord()}
            disabled={auth.loading}
            className="btn-ghost text-sm py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-40"
            title="Store characters in the cloud"
          >
            <span aria-hidden="true">☁</span>
            Sign in with Discord
          </button>
          <button
            type="button"
            onClick={() => navigateTo(CHARACTERS_PATH)}
            className="btn-ghost text-sm py-1.5 px-3 hidden sm:flex items-center"
            title="Browse characters other players have shared"
          >
            Public
          </button>
        </>
      )}

      {view !== null && (
        <div
          role="dialog"
          aria-label="Cloud saves"
          className="absolute right-0 top-full mt-2 z-50 w-[min(92vw,24rem)] max-h-[70vh] overflow-y-auto
                     rounded-lg border border-charcoal-700 bg-charcoal-950 shadow-2xl p-4
                     flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-orange-400">
              {view === 'mine'
                ? 'My characters'
                : view === 'public'
                  ? 'Public characters'
                  : view === 'bulk'
                    ? 'Bulk upload'
                    : 'Cloud'}
            </h2>
            <button
              type="button"
              onClick={() => setView(null)}
              className="text-charcoal-400 hover:text-orange-400 text-sm leading-none"
              aria-label="Close cloud panel"
            >
              ✕
            </button>
          </div>

          {auth.error && (
            <p className="text-red-400 text-xs" role="alert">
              {auth.error}
            </p>
          )}

          {view !== 'menu' && (
            <button
              type="button"
              onClick={() => setView(signedIn ? 'menu' : null)}
              className="text-charcoal-500 hover:text-orange-400 text-xs self-start"
            >
              ← Back
            </button>
          )}

          {view === 'menu' && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void saveNow()}
                disabled={!canSave || saveState.status === 'saving'}
                className="btn-ghost text-sm py-1.5 px-3 text-left disabled:opacity-40"
              >
                {saveState.status === 'saving'
                  ? 'Saving…'
                  : isUpdate
                    ? 'Save to cloud (update)'
                    : 'Save to cloud'}
              </button>
              {saveState.message && (
                <p
                  className={`text-xs ${saveState.status === 'error' ? 'text-red-400' : 'text-green-400'}`}
                  role={saveState.status === 'error' ? 'alert' : 'status'}
                >
                  {saveState.message}
                </p>
              )}
              <button
                type="button"
                onClick={() => setView('mine')}
                className="btn-ghost text-sm py-1.5 px-3 text-left"
              >
                My characters
              </button>
              <button
                type="button"
                onClick={() => setView('public')}
                className="btn-ghost text-sm py-1.5 px-3 text-left"
              >
                Public characters
              </button>
              <button
                type="button"
                onClick={() => {
                  setView(null);
                  navigateTo(CHARACTERS_PATH);
                }}
                className="btn-ghost text-sm py-1.5 px-3 text-left"
                title="Searchable table of your characters and every public one"
              >
                Browse all characters
              </button>
              <button
                type="button"
                onClick={() => setView('bulk')}
                className="btn-ghost text-sm py-1.5 px-3 text-left"
                title="Upload many saved character files to your account at once"
              >
                Bulk upload
              </button>
              <button
                type="button"
                onClick={() => {
                  setView(null);
                  void auth.signOut();
                }}
                className="btn-ghost text-sm py-1.5 px-3 text-left text-red-400 hover:text-red-300"
              >
                Sign out
              </button>
            </div>
          )}

          {view === 'mine' && auth.client && auth.userId && (
            <MyCharactersPanel
              client={auth.client}
              userId={auth.userId}
              onLoaded={(loaded) => {
                setView(null);
                announceLoaded(loaded);
              }}
            />
          )}

          {view === 'bulk' && auth.client && auth.userId && (
            <BulkUploadPanel
              client={auth.client}
              userId={auth.userId}
              onViewMine={() => setView('mine')}
            />
          )}

          {view === 'public' && auth.client && (
            <PublicCharactersPanel
              client={auth.client}
              viewerId={auth.userId}
              onLoaded={(loaded) => {
                setView(null);
                announceLoaded(loaded);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

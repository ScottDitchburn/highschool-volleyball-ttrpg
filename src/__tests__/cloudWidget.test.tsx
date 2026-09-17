// @vitest-environment jsdom
// src/__tests__/cloudWidget.test.tsx
// The banner Cloud control: invisible without env vars, sign-in when signed out.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor, fireEvent } from '@testing-library/react';
import { CharacterProvider } from '../state/characterStore';
import { CloudProvider } from '../cloud/auth';
import { CloudWidget } from '../cloud/CloudWidget';
import { setCloudClientForTests } from '../cloud/client';
import { makeFakeAuth, makeFakeDb, fakeSession } from './helpers/fakeCloudClient';
import type { CloudResult } from '../cloud/types';

function configure() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key');
}

function emptyRows(): CloudResult<unknown> {
  return { data: [], error: null };
}

function renderWidget() {
  return render(
    <CharacterProvider>
      <CloudProvider>
        <CloudWidget />
      </CloudProvider>
    </CharacterProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  setCloudClientForTests(null);
  vi.unstubAllEnvs();
});

describe('CloudWidget', () => {
  it('renders no cloud controls at all when Supabase is not configured', async () => {
    vi.stubEnv('DEV', false);
    const { container } = renderWidget();
    await act(async () => {});

    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('shows a muted hint in dev builds instead of failing silently', async () => {
    vi.stubEnv('DEV', true);
    renderWidget();
    await act(async () => {});

    expect(screen.getByText(/cloud saves not configured/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /discord/i })).toBeNull();
  });

  it('offers Discord sign-in when configured but signed out', async () => {
    configure();
    const auth = makeFakeAuth(null);
    setCloudClientForTests(makeFakeDb(emptyRows, auth.auth).client);

    renderWidget();

    const button = await screen.findByRole('button', { name: /sign in with discord/i });
    // Disabled until getSession() settles; clicking earlier is a no-op.
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    await act(async () => {
      fireEvent.click(button);
    });
    // The sign-in awaits the lazily created client, so the call lands a tick later.
    await waitFor(() => expect(auth.signInCalls[0]?.provider).toBe('discord'));
    // Signed out, the only other affordance is browsing what people shared.
    expect(screen.getByRole('button', { name: /^public$/i })).toBeTruthy();
  });

  it('shows the Discord name and the cloud menu when signed in', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    setCloudClientForTests(
      makeFakeDb(
        (call) =>
          call.table === 'profiles'
            ? { data: { id: 'user-1', username: 'ninja_shoyo', avatar_url: null }, error: null }
            : emptyRows(),
        auth.auth,
      ).client,
    );

    renderWidget();

    const trigger = await screen.findByRole('button', { name: /ninja_shoyo/i });
    await act(async () => {
      fireEvent.click(trigger);
    });

    const dialog = screen.getByRole('dialog', { name: /cloud saves/i });
    expect(dialog).toBeTruthy();
    expect(screen.getByRole('button', { name: /save to cloud/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /my characters/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /public characters/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
  });

  it('lists the signed-in user’s cloud characters', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    setCloudClientForTests(
      makeFakeDb((call) => {
        if (call.table === 'profiles') {
          return { data: { id: 'user-1', username: 'ninja_shoyo', avatar_url: null }, error: null };
        }
        return {
          data: [
            {
              id: 'row-1',
              owner_id: 'user-1',
              name: 'Kageyama',
              is_public: true,
              schema_version: 3,
              data: { schoolYear: 2 },
              updated_at: '2026-03-03T00:00:00.000Z',
            },
          ],
          error: null,
        };
      }, auth.auth).client,
    );

    renderWidget();

    const trigger = await screen.findByRole('button', { name: /ninja_shoyo/i });
    await act(async () => {
      fireEvent.click(trigger);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /my characters/i }));
    });

    await waitFor(() => expect(screen.getByText('Kageyama')).toBeTruthy());
    expect(screen.getByText('2nd Year')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /make kageyama public/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^load$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete kageyama/i })).toBeTruthy();
  });
});

describe('landing page cloud control', () => {
  it('shows the Discord sign-in button on the name-entry page when signed out', async () => {
    configure();
    const auth = makeFakeAuth(null);
    setCloudClientForTests(makeFakeDb(emptyRows, auth.auth).client);
    const { default: App } = await import('../App');
    render(<App />);
    expect(await screen.findByRole('button', { name: /sign in with discord/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /start building/i })).toBeTruthy();
  });

  it('shows the profile button on the name-entry page when signed in', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    setCloudClientForTests(
      makeFakeDb(
        (call) =>
          call.table === 'profiles'
            ? { data: { id: 'user-1', username: 'ninja_shoyo', avatar_url: null }, error: null }
            : emptyRows(),
        auth.auth,
      ).client,
    );
    const { default: App } = await import('../App');
    render(<App />);
    const trigger = await screen.findByRole('button', { name: /ninja_shoyo/i });
    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(screen.getByRole('button', { name: /my characters/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
  });
});

describe('Review step public toggle', () => {
  it('shows the saved character’s visibility and flips it', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    let isPublic = false;
    const db = makeFakeDb((call) => {
      if (call.table === 'profiles') return { data: { id: 'user-1', username: 'ninja_shoyo', avatar_url: null }, error: null };
      if (call.table === 'characters' && call.op === 'select' && call.single) {
        return { data: { id: 'row-1', is_public: isPublic }, error: null };
      }
      if (call.table === 'characters' && call.op === 'update') {
        isPublic = call.values?.is_public === true;
        return { data: null, error: null };
      }
      return emptyRows();
    }, auth.auth);
    setCloudClientForTests(db.client);

    const { CloudSaveButton } = await import('../cloud/CloudSaveButton');
    const { INITIAL_CHARACTER } = await import('../state/characterStore');
    const { STORAGE_KEY, SCHEMA_VERSION } = await import('../state/persistence');
    // Seed the store synchronously (autosave is debounced).
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      character: { ...INITIAL_CHARACTER, name: 'Saved', cloudId: 'row-1' },
    }));

    render(
      <CharacterProvider>
        <CloudProvider>
          <CloudSaveButton />
        </CloudProvider>
      </CharacterProvider>,
    );

    const box = await screen.findByRole('checkbox', { name: /make this character public/i });
    expect((box as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('Public')).toBeTruthy(); // label is constant; the tick carries the state

    await act(async () => {
      fireEvent.click(box);
    });
    await waitFor(() => expect((box as HTMLInputElement).checked).toBe(true));
    const update = db.calls.find((c) => c.op === 'update');
    expect(update?.values).toEqual({ is_public: true });
    expect(update?.filters).toEqual([{ column: 'id', value: 'row-1' }]);
  });
});

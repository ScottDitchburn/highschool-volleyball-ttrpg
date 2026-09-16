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
    await act(async () => {
      fireEvent.click(button);
    });
    expect(auth.signInCalls[0].provider).toBe('discord');
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

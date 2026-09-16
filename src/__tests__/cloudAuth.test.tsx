// @vitest-environment jsdom
// src/__tests__/cloudAuth.test.tsx
// Cloud auth context state transitions, driven by a fake client. No network.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor, fireEvent } from '@testing-library/react';
import { CloudProvider } from '../cloud/auth';
import { useCloudAuth } from '../cloud/authContext';
import { setCloudClientForTests } from '../cloud/client';
import { makeFakeAuth, makeFakeDb, fakeSession } from './helpers/fakeCloudClient';
import type { CloudResult } from '../cloud/types';

function configure() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key');
}

function Probe() {
  const { configured, loading, userId, displayName, avatarUrl, signInWithDiscord, signOut } =
    useCloudAuth();
  return (
    <div>
      <span data-testid="configured">{String(configured)}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{userId ?? 'none'}</span>
      <span data-testid="name">{displayName ?? 'none'}</span>
      <span data-testid="avatar">{avatarUrl ?? 'none'}</span>
      <button onClick={() => void signInWithDiscord()}>sign in</button>
      <button onClick={() => void signOut()}>sign out</button>
    </div>
  );
}

function profileResponder(): CloudResult<unknown> {
  return {
    data: { id: 'user-1', username: 'ninja_shoyo', avatar_url: 'https://cdn.example/a.png' },
    error: null,
  };
}

afterEach(() => {
  cleanup();
  setCloudClientForTests(null);
  vi.unstubAllEnvs();
});

describe('cloud auth context', () => {
  it('reports "not configured" and creates no client without env vars', async () => {
    const auth = makeFakeAuth();
    const getSession = vi.spyOn(auth.auth, 'getSession');
    setCloudClientForTests(makeFakeDb(profileResponder, auth.auth).client);

    render(
      <CloudProvider>
        <Probe />
      </CloudProvider>,
    );

    expect(screen.getByTestId('configured').textContent).toBe('false');
    expect(screen.getByTestId('loading').textContent).toBe('false');
    await act(async () => {});
    expect(getSession).not.toHaveBeenCalled();
  });

  it('starts signed out when the stored session is empty', async () => {
    configure();
    setCloudClientForTests(makeFakeDb(profileResponder, makeFakeAuth(null).auth).client);

    render(
      <CloudProvider>
        <Probe />
      </CloudProvider>,
    );

    expect(screen.getByTestId('configured').textContent).toBe('true');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('picks up an existing session and its profile row', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    setCloudClientForTests(makeFakeDb(profileResponder, auth.auth).client);

    render(
      <CloudProvider>
        <Probe />
      </CloudProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-1'));
    // Profile row wins over the raw Discord metadata once it arrives.
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('ninja_shoyo'));
    expect(screen.getByTestId('avatar').textContent).toBe('https://cdn.example/a.png');
  });

  it('follows onAuthStateChange in and back out', async () => {
    configure();
    const auth = makeFakeAuth(null);
    setCloudClientForTests(makeFakeDb(profileResponder, auth.auth).client);

    render(
      <CloudProvider>
        <Probe />
      </CloudProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await act(async () => {
      auth.emit('SIGNED_IN', fakeSession('user-1'));
    });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-1'));

    await act(async () => {
      auth.emit('SIGNED_OUT', null);
    });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
    expect(screen.getByTestId('name').textContent).toBe('none');
  });

  it('signs in through the Discord provider, returning to the current page', async () => {
    configure();
    const auth = makeFakeAuth(null);
    setCloudClientForTests(makeFakeDb(profileResponder, auth.auth).client);

    render(
      <CloudProvider>
        <Probe />
      </CloudProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'sign in' }));
    });

    expect(auth.signInCalls).toHaveLength(1);
    expect(auth.signInCalls[0].provider).toBe('discord');
    expect(auth.signInCalls[0].redirectTo).toBe(
      `${window.location.origin}${window.location.pathname}`,
    );
  });

  it('clears the session on sign out', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    setCloudClientForTests(makeFakeDb(profileResponder, auth.auth).client);

    render(
      <CloudProvider>
        <Probe />
      </CloudProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-1'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'sign out' }));
    });

    expect(auth.signOutCalls).toBe(1);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
  });
});

// @vitest-environment jsdom
// The /Characters table: merge/search/sort model plus the screen itself.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent, waitFor, within } from '@testing-library/react';
import { CharacterProvider } from '../state/characterStore';
import { CloudProvider } from '../cloud/auth';
import { CharactersScreen } from '../cloud/CharactersScreen';
import { setCloudClientForTests } from '../cloud/client';
import { makeFakeAuth, makeFakeDb, fakeSession } from './helpers/fakeCloudClient';
import {
  DEFAULT_SORT,
  filterRows,
  mergeCharacterRows,
  nextSort,
  sortRows,
} from '../cloud/tableModel';
import { toSummary } from '../cloud/characters';
import type { CloudCharacterSummary } from '../cloud/types';
import { consumeWizardRequest } from '../navigation';

function summary(over: Partial<CloudCharacterSummary> & { id: string; name: string }): CloudCharacterSummary {
  return {
    isPublic: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
    schoolYear: 1,
    graduated: false,
    ownerUsername: null,
    ownerId: null,
    heightCm: null,
    verticalCm: null,
    abilityCount: 0,
    ...over,
  };
}

describe('tableModel', () => {
  const mine = [
    summary({ id: 'a', name: 'Kageyama', isPublic: true, schoolYear: 1, heightCm: 180, updatedAt: '2026-03-01T00:00:00Z' }),
    summary({ id: 'b', name: 'Hinata', isPublic: false, schoolYear: 1, heightCm: 162, updatedAt: '2026-02-01T00:00:00Z' }),
  ];
  const shared = [
    summary({ id: 'a', name: 'Kageyama', isPublic: true, ownerUsername: 'Scooter' }),
    summary({ id: 'c', name: 'Ushijima', isPublic: true, schoolYear: 3, ownerUsername: 'wakatoshi', heightCm: 189, updatedAt: '2026-04-01T00:00:00Z' }),
    summary({ id: 'd', name: 'Oikawa', isPublic: true, graduated: true, ownerUsername: null, updatedAt: '2026-01-15T00:00:00Z' }),
  ];

  it('merges mine with public, deduplicating my own public rows as mine', () => {
    const rows = mergeCharacterRows(mine, shared, 'Scooter');
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(rows[0].source).toBe('mine');
    expect(rows[0].ownerLabel).toBe('Scooter');
    expect(rows[2].ownerLabel).toBe('wakatoshi');
    expect(rows[3].ownerLabel).toBe('unknown player');
    expect(rows[3].yearLabel).toBe('Graduate');
  });

  it('labels my rows "You" without a display name', () => {
    expect(mergeCharacterRows(mine, [], null)[0].ownerLabel).toBe('You');
  });

  it('filters by owner, name or year, case-insensitively, within a scope', () => {
    const rows = mergeCharacterRows(mine, shared, 'Scooter');
    expect(filterRows(rows, 'waka', 'all').map((r) => r.id)).toEqual(['c']);
    expect(filterRows(rows, 'KAGE', 'all').map((r) => r.id)).toEqual(['a']);
    expect(filterRows(rows, '1st', 'all').map((r) => r.id)).toEqual(['a', 'b']);
    expect(filterRows(rows, '', 'mine').map((r) => r.id)).toEqual(['a', 'b']);
    expect(filterRows(rows, '', 'public').map((r) => r.id)).toEqual(['a', 'c', 'd']);
    expect(filterRows(rows, 'hinata', 'public')).toEqual([]);
  });

  it('sorts by column with nulls last and a stable name tiebreak', () => {
    const rows = mergeCharacterRows(mine, shared, 'Scooter');
    expect(sortRows(rows, DEFAULT_SORT).map((r) => r.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(sortRows(rows, { key: 'height', direction: 'asc' }).map((r) => r.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(sortRows(rows, { key: 'height', direction: 'desc' }).map((r) => r.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(sortRows(rows, { key: 'owner', direction: 'asc' }).map((r) => r.ownerLabel)).toEqual([
      'Scooter', 'Scooter', 'unknown player', 'wakatoshi',
    ]);
    expect(sortRows(rows, { key: 'year', direction: 'desc' }).map((r) => r.id)).toEqual(['d', 'c', 'b', 'a']); // 1st-year tie: Hinata before Kageyama by name
  });

  it('flips direction on the same key and starts ascending on a new one', () => {
    expect(nextSort(DEFAULT_SORT, 'updated')).toEqual({ key: 'updated', direction: 'asc' });
    expect(nextSort(DEFAULT_SORT, 'name')).toEqual({ key: 'name', direction: 'asc' });
    expect(nextSort({ key: 'name', direction: 'asc' }, 'updated')).toEqual({ key: 'updated', direction: 'desc' });
  });

  it('toSummary extracts height, vertical and ability count from the payload', () => {
    const s = toSummary({
      id: 'x',
      owner_id: 'u',
      name: 'Bokuto',
      schema_version: 3,
      data: { schoolYear: 3, physical: { heightCm: 185, verticalCm: 96 }, selectedAbilities: [{}, {}] },
    });
    expect(s).toMatchObject({ ownerId: 'u', heightCm: 185, verticalCm: 96, abilityCount: 2, schoolYear: 3 });
    expect(toSummary({ id: 'y', name: 'Blank', schema_version: 3, data: {} })).toMatchObject({
      heightCm: null, verticalCm: null, abilityCount: 0,
    });
  });
});

// ── screen ───────────────────────────────────────────────────────────────────

function configure() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key');
}

const MINE_ROWS = [
  {
    id: 'row-1', owner_id: 'user-1', name: 'Kageyama', is_public: true, schema_version: 3,
    data: { schoolYear: 1, physical: { heightCm: 180, verticalCm: 84 }, selectedAbilities: [{}] },
    updated_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'row-2', owner_id: 'user-1', name: 'Hinata', is_public: false, schema_version: 3,
    data: { schoolYear: 1, physical: { heightCm: 162, verticalCm: 99 }, selectedAbilities: [] },
    updated_at: '2026-03-02T00:00:00.000Z',
  },
];
const PUBLIC_ROWS = [
  {
    id: 'row-1', owner_id: 'user-1', name: 'Kageyama', owner_username: 'ninja_shoyo', schema_version: 3,
    data: { schoolYear: 1 }, updated_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'row-9', owner_id: 'user-2', name: 'Ushijima', owner_username: 'wakatoshi', schema_version: 3,
    data: { schoolYear: 3, physical: { heightCm: 189, verticalCm: 90 }, selectedAbilities: [{}, {}, {}] },
    updated_at: '2026-03-04T00:00:00.000Z',
  },
];

function respond(call: { table: string }) {
  if (call.table === 'profiles') {
    return { data: { id: 'user-1', username: 'ninja_shoyo', avatar_url: null }, error: null };
  }
  if (call.table === 'characters') return { data: MINE_ROWS, error: null };
  if (call.table === 'public_characters') return { data: PUBLIC_ROWS, error: null };
  return { data: [], error: null };
}

function renderScreen(onBack = vi.fn()) {
  render(
    <CharacterProvider>
      <CloudProvider>
        <CharactersScreen onBack={onBack} />
      </CloudProvider>
    </CharacterProvider>,
  );
  return onBack;
}

beforeEach(() => {
  localStorage.clear();
  consumeWizardRequest();
});

afterEach(() => {
  cleanup();
  setCloudClientForTests(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('CharactersScreen', () => {
  it('puts the owner in the first column and merges my rows with public ones', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    setCloudClientForTests(makeFakeDb(respond, auth.auth).client);

    renderScreen();

    const rows = await screen.findAllByRole('row');
    const header = within(rows[0]).getAllByRole('columnheader');
    expect(header[0].textContent).toMatch(/^Owner/);

    await waitFor(() => expect(screen.getByText('Ushijima')).toBeTruthy());
    // Three distinct characters: row-1 appears once (mine), not twice.
    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(3);
    const first = within(bodyRows[0]).getAllByRole('cell');
    expect(first[0].textContent).toBe('wakatoshi');   // newest first by default
    expect(first[1].textContent).toBe('Ushijima');
    expect(screen.getAllByText('ninja_shoyo').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/3 of 3 characters shown/)).toBeTruthy();
  });

  it('searches across owner and character names', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    setCloudClientForTests(makeFakeDb(respond, auth.auth).client);

    renderScreen();
    await waitFor(() => expect(screen.getByText('Ushijima')).toBeTruthy());

    fireEvent.change(screen.getByRole('searchbox', { name: /search characters/i }), {
      target: { value: 'waka' },
    });
    expect(screen.queryByText('Kageyama')).toBeNull();
    expect(screen.getByText('Ushijima')).toBeTruthy();
    expect(screen.getByText(/1 of 3 characters shown/)).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox', { name: /search characters/i }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText(/No characters match/)).toBeTruthy();
  });

  it('offers Load/Delete/Public only on my rows and Load copy on others', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    setCloudClientForTests(makeFakeDb(respond, auth.auth).client);

    renderScreen();
    await waitFor(() => expect(screen.getByText('Ushijima')).toBeTruthy());

    expect(screen.getAllByRole('button', { name: /^load$/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^load copy$/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^delete/i })).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: /make hinata public/i })).toBeTruthy();
  });

  it('loads a character into the builder and asks for the wizard', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    setCloudClientForTests(
      makeFakeDb((call) => {
        if (call.single && call.table === 'characters') {
          return {
            data: {
              id: 'row-2', owner_id: 'user-1', name: 'Hinata', is_public: false, schema_version: 3,
              data: { ...JSON.parse(JSON.stringify(EMPTY_CHAR)), name: 'Hinata' },
            },
            error: null,
          };
        }
        return respond(call);
      }, auth.auth).client,
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const onBack = renderScreen();
    await waitFor(() => expect(screen.getByText('Hinata')).toBeTruthy());

    const hinataRow = screen.getAllByRole('row').find((r) => within(r).queryByText('Hinata'))!;
    await act(async () => {
      fireEvent.click(within(hinataRow).getByRole('button', { name: /^load$/i }));
    });

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    expect(consumeWizardRequest()).toBe(true);
  });

  it('shows public rows and a sign-in prompt when signed out', async () => {
    configure();
    const auth = makeFakeAuth(null);
    setCloudClientForTests(makeFakeDb(respond, auth.auth).client);

    renderScreen();
    await waitFor(() => expect(screen.getByText('Ushijima')).toBeTruthy());

    expect(screen.getByRole('button', { name: /sign in with discord/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^mine$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^load$/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^load copy$/i })).toHaveLength(2);
  });
});

// A minimal valid persisted character for the load round trip.
import { INITIAL_CHARACTER } from '../state/characterStore';
const EMPTY_CHAR = INITIAL_CHARACTER;

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
  applyAdvancedFilter,
  filterRows,
  mergeCharacterRows,
  nextSort,
  sortRows,
  statSortKey,
} from '../cloud/tableModel';
import { makePhysicalAttributes, type SkillStats } from '../types';
import { INITIAL_CHARACTER as BLANK } from '../state/characterStore';
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
    abilityIds: [],
    stats: null,
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

  it('applies stat conditions and required abilities together (AND)', () => {
    const tens = (v: number): SkillStats => ({
      Spike: v, Serve: v, Pass: v, Dig: v, Set: v, Block: v, Speed: v, Power: v, IQ: v, Stamina: v,
    });
    const rows = mergeCharacterRows(
      [
        summary({ id: 'a', name: 'Kageyama', stats: { ...tens(3), Set: 4, Spike: 3.5 }, abilityIds: ['setter-dumps', 'training'] }),
        summary({ id: 'b', name: 'Hinata', stats: { ...tens(2.5), Speed: 4 }, abilityIds: ['hustle'] }),
        summary({ id: 'c', name: 'Blank', stats: null, abilityIds: [] }),
      ],
      [],
      'me',
    );
    const pick = (f: Parameters<typeof applyAdvancedFilter>[1]) => applyAdvancedFilter(rows, f).map((r) => r.id);

    expect(pick({ stats: [], abilityIds: [] })).toEqual(['a', 'b', 'c']);
    expect(pick({ stats: [{ stat: 'Set', op: 'gte', value: 4 }], abilityIds: [] })).toEqual(['a']);
    expect(pick({ stats: [{ stat: 'Spike', op: 'lte', value: 3 }], abilityIds: [] })).toEqual(['b']);
    expect(pick({ stats: [{ stat: 'Set', op: 'gte', value: 3 }, { stat: 'Speed', op: 'gte', value: 3.5 }], abilityIds: [] })).toEqual([]);
    expect(pick({ stats: [], abilityIds: ['training'] })).toEqual(['a']);
    expect(pick({ stats: [], abilityIds: ['training', 'hustle'] })).toEqual([]);
    expect(pick({ stats: [{ stat: 'Set', op: 'gte', value: 3.5 }], abilityIds: ['setter-dumps'] })).toEqual(['a']);
    // Unreadable stats never satisfy a stat condition.
    expect(pick({ stats: [{ stat: 'IQ', op: 'lte', value: 5 }], abilityIds: [] })).toEqual(['a', 'b']);
  });

  it('sorts by a stat column with unreadable stats last', () => {
    const rows = mergeCharacterRows(
      [
        summary({ id: 'a', name: 'A', stats: { Spike: 3, Serve: 1, Pass: 1, Dig: 1, Set: 1, Block: 1, Speed: 1, Power: 1, IQ: 1, Stamina: 1 } }),
        summary({ id: 'b', name: 'B', stats: { Spike: 4, Serve: 1, Pass: 1, Dig: 1, Set: 1, Block: 1, Speed: 1, Power: 1, IQ: 1, Stamina: 1 } }),
        summary({ id: 'c', name: 'C', stats: null }),
      ],
      [],
      'me',
    );
    expect(sortRows(rows, { key: statSortKey('Spike'), direction: 'desc' }).map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(sortRows(rows, { key: statSortKey('Spike'), direction: 'asc' }).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('toSummary computes effective stats and ability ids from a full character payload', () => {
    const payload = {
      ...BLANK,
      name: 'Training Dummy',
      physical: makePhysicalAttributes(15, 15),
      skills: { Spike: 3, Serve: 3, Pass: 3, Dig: 3, Set: 3, Block: 3, Speed: 3, Power: 3, IQ: 3, Stamina: 3 },
      selectedAbilities: [{ uid: 'g', abilityId: 'game-study', tier: 0, chooserSelections: {} }],
    };
    const s = toSummary({ id: 'z', name: 'Training Dummy', schema_version: 3, data: payload });
    expect(s.abilityIds).toEqual(['game-study']);
    expect(s.stats?.IQ).toBeCloseTo(3.25, 5);      // Game Study +0.25 IQ
    expect(s.stats?.Stamina).toBeCloseTo(2.75, 5); // Game Study -0.25 Stamina
    expect(s.stats?.Spike).toBe(3);
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

  it('renders the ten stat columns and applies an advanced stat filter', async () => {
    configure();
    const auth = makeFakeAuth(fakeSession('user-1'));
    const withStats = (name: string, iq: number) => ({
      ...BLANK,
      name,
      physical: makePhysicalAttributes(15, 15),
      skills: { Spike: 3, Serve: 3, Pass: 3, Dig: 3, Set: 3, Block: 3, Speed: 3, Power: 3, IQ: iq, Stamina: 3 },
      selectedAbilities: [],
    });
    setCloudClientForTests(
      makeFakeDb((call) => {
        if (call.table === 'profiles') return { data: { id: 'user-1', username: 'ninja_shoyo', avatar_url: null }, error: null };
        if (call.table === 'characters') {
          return {
            data: [
              { id: 'r1', owner_id: 'user-1', name: 'Brainy', is_public: false, schema_version: 3, data: withStats('Brainy', 4), updated_at: '2026-03-03T00:00:00.000Z' },
              { id: 'r2', owner_id: 'user-1', name: 'Dozy', is_public: false, schema_version: 3, data: withStats('Dozy', 2), updated_at: '2026-03-02T00:00:00.000Z' },
            ],
            error: null,
          };
        }
        return { data: [], error: null };
      }, auth.auth).client,
    );

    renderScreen();
    await waitFor(() => expect(screen.getByText('Dozy')).toBeTruthy());

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.replace(/[▲▼]/g, '').trim());
    for (const name of ['Spike', 'Serve', 'Pass', 'Dig', 'Set', 'Block', 'Speed', 'Power', 'IQ', 'Stam']) {
      expect(headers).toContain(name);
    }
    const brainyRow = screen.getAllByRole('row').find((r) => within(r).queryByText('Brainy'))!;
    expect(within(brainyRow).getAllByRole('cell').map((c) => c.textContent)).toContain('4.00');

    // Open filters, add "IQ at least 3.5": only Brainy remains.
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }));
    fireEvent.click(screen.getByRole('button', { name: /add stat condition/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /stat for condition 1/i }), { target: { value: 'IQ' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /value for condition 1/i }), { target: { value: '3.5' } });
    expect(screen.getByText('Brainy')).toBeTruthy();
    expect(screen.queryByText('Dozy')).toBeNull();
    expect(screen.getByRole('button', { name: /filters \(1\)/i })).toBeTruthy();

    // Require an ability nobody has: nothing matches.
    fireEvent.change(screen.getByRole('combobox', { name: /ability to require/i }), { target: { value: 'hustle' } });
    fireEvent.click(screen.getByRole('button', { name: /require ability/i }));
    expect(screen.getByText(/No characters match/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(screen.getByText('Dozy')).toBeTruthy();
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

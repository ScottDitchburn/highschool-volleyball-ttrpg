// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { Character } from '../types';
import { coachReducer, benchPlayers, duplicateNumbers } from '../coach/coachStore';
import type { CoachAction } from '../coach/coachStore';
import { emptyCoachState, type CoachState, MAX_ROSTER } from '../coach/types';
import {
  exportCoach,
  importCoachFromFile,
  COACH_STORAGE_KEY,
  loadCoach,
  autosaveCoach,
} from '../coach/persistence';
import { buildCoachDiscordExport } from '../coach/export/coachDiscord';

// ── Minimal character factory ──────────────────────────────────────────────────

function makeCharacter(name: string): Character {
  return {
    name,
    schoolYear: 1,
    physicalPool: { rollA: null, rollB: null },
    physical: { heightRoll: 15, verticalRoll: 10, heightCm: 180, verticalCm: 75 },
    reaches: null,
    skillPool: { rolls: Array(10).fill(null) },
    skills: {
      Spike: 3, Serve: 2, Pass: 2.5, Dig: 2, Set: 1.5,
      Block: 2, Speed: 3.5, Power: 2, IQ: 1.5, Stamina: 2,
    },
    yearRoll: 1,
    experience: null,
    apBudget: { base: 10, yearBonus: 0, experienceBonus: 0, levelUpGains: 0, total: 10, spent: 0, remaining: 10 },
    selectedAbilities: [],
    levelUpHistory: [],
    seed: null,
    seeded: false,
  };
}

function reduce(state: CoachState, ...actions: CoachAction[]): CoachState {
  return actions.reduce((s, a) => coachReducer(s, a), state);
}

// jsdom's Blob/File lack a working .text(); read via FileReader and feed the
// importer a minimal File-like stub (it only calls .text()).
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(blob);
  });
}

function fileFrom(json: string): File {
  return { text: async () => json } as unknown as File;
}

/** Build a roster of n players and return state + their ids in order. */
function withRoster(n: number): { state: CoachState; ids: string[] } {
  const chars = Array.from({ length: n }, (_, i) => makeCharacter(`P${i + 1}`));
  const state = coachReducer(emptyCoachState(), { type: 'ADD_PLAYERS', characters: chars });
  return { state, ids: state.roster.map((p) => p.id) };
}

beforeEach(() => {
  localStorage.clear();
});

// ── Roster management ──────────────────────────────────────────────────────────

describe('coach roster', () => {
  it('adds players and caps the roster at 12', () => {
    const { state } = withRoster(15);
    expect(state.roster).toHaveLength(MAX_ROSTER);
  });

  it('does not exceed the cap across multiple imports', () => {
    let { state } = withRoster(10);
    state = coachReducer(state, {
      type: 'ADD_PLAYERS',
      characters: [makeCharacter('a'), makeCharacter('b'), makeCharacter('c')],
    });
    expect(state.roster).toHaveLength(MAX_ROSTER);
  });

  it('assigns number and position', () => {
    const { state, ids } = withRoster(1);
    const next = reduce(
      state,
      { type: 'SET_NUMBER', id: ids[0], number: 7 },
      { type: 'SET_POSITION', id: ids[0], position: 'WS' }
    );
    expect(next.roster[0].number).toBe(7);
    expect(next.roster[0].position).toBe('WS');
  });

  it('detects duplicate numbers', () => {
    const { state, ids } = withRoster(3);
    const next = reduce(
      state,
      { type: 'SET_NUMBER', id: ids[0], number: 7 },
      { type: 'SET_NUMBER', id: ids[1], number: 7 },
      { type: 'SET_NUMBER', id: ids[2], number: 9 }
    );
    expect(duplicateNumbers(next)).toEqual(new Set([7]));
  });

  it('removing a player also clears their lineup placement', () => {
    const { state, ids } = withRoster(2);
    let next = coachReducer(state, { type: 'PLACE', playerId: ids[0], target: { kind: 'slot', slot: 'I' } });
    expect(next.lineup.slots.I).toBe(ids[0]);
    next = coachReducer(next, { type: 'REMOVE_PLAYER', id: ids[0] });
    expect(next.lineup.slots.I).toBeNull();
    expect(next.roster).toHaveLength(1);
  });
});

// ── Lineup placement ───────────────────────────────────────────────────────────

describe('lineup placement', () => {
  it('places a player into a slot', () => {
    const { state, ids } = withRoster(1);
    const next = coachReducer(state, { type: 'PLACE', playerId: ids[0], target: { kind: 'slot', slot: 'III' } });
    expect(next.lineup.slots.III).toBe(ids[0]);
  });

  it('a player can only occupy one slot (move, not duplicate)', () => {
    const { state, ids } = withRoster(1);
    let next = coachReducer(state, { type: 'PLACE', playerId: ids[0], target: { kind: 'slot', slot: 'I' } });
    next = coachReducer(next, { type: 'PLACE', playerId: ids[0], target: { kind: 'slot', slot: 'VI' } });
    expect(next.lineup.slots.I).toBeNull();
    expect(next.lineup.slots.VI).toBe(ids[0]);
  });

  it('swaps two placed players when one is dropped onto the other', () => {
    const { state, ids } = withRoster(2);
    let next = reduce(
      state,
      { type: 'PLACE', playerId: ids[0], target: { kind: 'slot', slot: 'I' } },
      { type: 'PLACE', playerId: ids[1], target: { kind: 'slot', slot: 'II' } }
    );
    // drop player0 onto player1's slot → they swap
    next = coachReducer(next, { type: 'PLACE', playerId: ids[0], target: { kind: 'slot', slot: 'II' } });
    expect(next.lineup.slots.II).toBe(ids[0]);
    expect(next.lineup.slots.I).toBe(ids[1]);
  });

  it('benches the occupant when a bench player replaces them', () => {
    const { state, ids } = withRoster(2);
    let next = coachReducer(state, { type: 'PLACE', playerId: ids[0], target: { kind: 'libero' } });
    next = coachReducer(next, { type: 'PLACE', playerId: ids[1], target: { kind: 'libero' } });
    expect(next.lineup.libero).toBe(ids[1]);
    expect(benchPlayers(next).map((p) => p.id)).toContain(ids[0]);
  });

  it('clears a target', () => {
    const { state, ids } = withRoster(1);
    let next = coachReducer(state, { type: 'PLACE', playerId: ids[0], target: { kind: 'slot', slot: 'IV' } });
    next = coachReducer(next, { type: 'CLEAR_TARGET', target: { kind: 'slot', slot: 'IV' } });
    expect(next.lineup.slots.IV).toBeNull();
    expect(benchPlayers(next).map((p) => p.id)).toContain(ids[0]);
  });

  it('ignores placement of unknown player ids', () => {
    const { state } = withRoster(1);
    const next = coachReducer(state, { type: 'PLACE', playerId: 'ghost', target: { kind: 'slot', slot: 'I' } });
    expect(next.lineup.slots.I).toBeNull();
  });
});

// ── Persistence round-trip ─────────────────────────────────────────────────────

describe('coach persistence', () => {
  it('exports and re-imports a coach state losslessly', async () => {
    const { state, ids } = withRoster(2);
    const populated = reduce(
      state,
      { type: 'SET_TEAM_NAME', name: 'Karasuno' },
      { type: 'SET_NUMBER', id: ids[0], number: 10 },
      { type: 'SET_POSITION', id: ids[0], position: 'MB' },
      { type: 'PLACE', playerId: ids[0], target: { kind: 'slot', slot: 'I' } },
      { type: 'PLACE', playerId: ids[1], target: { kind: 'libero' } }
    );

    const { blob } = exportCoach(populated);
    const result = await importCoachFromFile(fileFrom(await blobText(blob)));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.coach.teamName).toBe('Karasuno');
    expect(result.coach.roster).toHaveLength(2);
    expect(result.coach.lineup.slots.I).toBe(ids[0]);
    expect(result.coach.lineup.libero).toBe(ids[1]);
    expect(result.coach.roster[0].number).toBe(10);
    expect(result.coach.roster[0].position).toBe('MB');
  });

  it('rejects a non-coach JSON file', async () => {
    const result = await importCoachFromFile(fileFrom(JSON.stringify({ hello: 'world' })));
    expect(result.ok).toBe(false);
  });

  it('drops lineup references to players that no longer exist', async () => {
    // Hand-craft an envelope whose lineup points at a missing id.
    const envelope = {
      version: 1,
      savedAt: new Date().toISOString(),
      coach: {
        teamName: 'Ghosts',
        roster: [],
        lineup: { slots: { I: 'missing', II: null, III: null, IV: null, V: null, VI: null }, libero: 'missing' },
      },
    };
    const result = await importCoachFromFile(fileFrom(JSON.stringify(envelope)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.coach.lineup.slots.I).toBeNull();
    expect(result.coach.lineup.libero).toBeNull();
  });

  it('autosaves to its own storage key and reloads', () => {
    const { state } = withRoster(1);
    autosaveCoach(state, 0);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(localStorage.getItem(COACH_STORAGE_KEY)).toBeTruthy();
        const loaded = loadCoach();
        expect(loaded?.roster).toHaveLength(1);
        resolve();
      }, 10);
    });
  });
});

// ── Discord export ─────────────────────────────────────────────────────────────

describe('coach discord export', () => {
  it('stays under the 2000-char limit for a full 12-player team', () => {
    const { state, ids } = withRoster(12);
    let populated: CoachState = { ...state, teamName: 'Nekoma' };
    ids.forEach((id, i) => {
      populated = reduce(
        populated,
        { type: 'SET_NUMBER', id, number: i + 1 },
        { type: 'SET_POSITION', id, position: 'WS' }
      );
    });
    const text = buildCoachDiscordExport(populated);
    expect(text.length).toBeLessThanOrEqual(2000);
    expect(text).toContain('Nekoma');
    expect(text).toContain('ROSTER (12)');
  });
});

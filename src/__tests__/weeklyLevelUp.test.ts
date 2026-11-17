// src/__tests__/weeklyLevelUp.test.ts
// Weekly level-up system: AP accrual, the one-way mode switch and its revert,
// the CSV audit trail, persistence round-trips and the export hooks.
import { describe, it, expect } from 'vitest';
import { characterReducer, INITIAL_CHARACTER } from '../state/characterStore';
import {
  isLevelUpModeLocked,
  levelUpModeOf,
  makePhysicalAttributes,
  summariseWeeklyMatches,
  weeklyMatchAp,
  weeklyMatchesOf,
  type Character,
  type WeeklyMatchRecord,
} from '../types';
import { buildWeeklyMatchCsv, weeklyCsvFileName } from '../export/weeklyCsv';
import { buildCharacterWorkbook } from '../export/excel';
import { buildDiscordExport } from '../export/discord';
import { adoptCharacter, SCHEMA_VERSION } from '../state/persistence';

// Height roll 15 -> 178 cm; v.3 modifier -2 turns a raw vertical 17 into 84 cm.
function base(overrides: Partial<Character> = {}): Character {
  return {
    ...INITIAL_CHARACTER,
    schoolYear: 1,
    yearRoll: 1,
    physical: makePhysicalAttributes(15, 17),
    ...overrides,
  };
}

function weekly(overrides: Partial<Character> = {}): Character {
  return base({ levelUpMode: 'weekly', ...overrides });
}

function match(over: Partial<WeeklyMatchRecord> = {}): WeeklyMatchRecord {
  return {
    uid: 'm1',
    result: 'win',
    apGained: 2,
    note: '',
    recordedAt: '2026-11-17T10:00:00.000Z',
    year: 1,
    ...over,
  };
}

describe('weekly AP table', () => {
  it('awards 2 AP for a win and 1 for a loss', () => {
    expect(weeklyMatchAp('win')).toBe(2);
    expect(weeklyMatchAp('loss')).toBe(1);
  });
});

describe('summariseWeeklyMatches', () => {
  it('totals played, wins, losses, AP and win rate', () => {
    const s = summariseWeeklyMatches([
      match({ uid: 'a', result: 'win', apGained: 2 }),
      match({ uid: 'b', result: 'loss', apGained: 1 }),
      match({ uid: 'c', result: 'win', apGained: 2 }),
      match({ uid: 'd', result: 'win', apGained: 2 }),
    ]);
    expect(s).toEqual({ played: 4, wins: 3, losses: 1, apGained: 7, winRate: 0.75 });
  });

  it('reports a 0 win rate for an empty log rather than NaN', () => {
    expect(summariseWeeklyMatches([])).toEqual({
      played: 0, wins: 0, losses: 0, apGained: 0, winRate: 0,
    });
  });
});

describe('RECORD_WEEKLY_MATCH', () => {
  it('banks AP, appends the record and trims the note', () => {
    const start = weekly();
    const next = characterReducer(start, {
      type: 'RECORD_WEEKLY_MATCH', result: 'win', note: '  vs Nekoma — 2-1  ',
    });
    expect(next.apBudget.levelUpGains).toBe(2);
    expect(next.apBudget.total).toBe(start.apBudget.total + 2);
    expect(next.weeklyMatches).toHaveLength(1);
    expect(next.weeklyMatches![0]).toMatchObject({
      result: 'win', apGained: 2, note: 'vs Nekoma — 2-1', year: 1,
    });
    expect(next.weeklyMatches![0].uid).toBeTruthy();
    expect(Number.isNaN(Date.parse(next.weeklyMatches![0].recordedAt))).toBe(false);
  });

  it('never advances the year, grows height or graduates', () => {
    let char = weekly({ schoolYear: 3, yearRoll: 3 });
    for (let i = 0; i < 12; i++) {
      char = characterReducer(char, { type: 'RECORD_WEEKLY_MATCH', result: 'win', note: '' });
    }
    expect(char.apBudget.levelUpGains).toBe(24);
    expect(char.schoolYear).toBe(3);
    expect(char.physical!.heightCm).toBe(178);
    expect(char.graduated).toBeFalsy();
    expect(char.levelUpHistory).toHaveLength(0);
  });

  it('accumulates mixed results in order', () => {
    let char = weekly();
    for (const result of ['win', 'loss', 'loss', 'win'] as const) {
      char = characterReducer(char, { type: 'RECORD_WEEKLY_MATCH', result, note: '' });
    }
    expect(weeklyMatchesOf(char).map((m) => m.result)).toEqual(['win', 'loss', 'loss', 'win']);
    expect(char.apBudget.levelUpGains).toBe(6);
  });

  it('is ignored while the character is on the Tournament system', () => {
    const tournament = base({ levelUpMode: 'tournament' });
    expect(characterReducer(tournament, {
      type: 'RECORD_WEEKLY_MATCH', result: 'win', note: 'x',
    })).toBe(tournament);

    // An unchosen character behaves as Tournament, so it is ignored there too.
    const unchosen = base();
    expect(characterReducer(unchosen, {
      type: 'RECORD_WEEKLY_MATCH', result: 'win', note: 'x',
    })).toBe(unchosen);
  });
});

describe('SET_LEVEL_UP_MODE', () => {
  it('leaves the picker open until a system is committed', () => {
    const char = base();
    expect(levelUpModeOf(char)).toBe('tournament');
    expect(isLevelUpModeLocked(char)).toBe(false);
    expect(isLevelUpModeLocked(characterReducer(char, {
      type: 'SET_LEVEL_UP_MODE', mode: 'tournament',
    }))).toBe(true);
  });

  it('reverts every level-up gain when switching away from Tournament', () => {
    let char = base({ selectedAbilities: [
      { uid: 'a1', abilityId: 'training', tier: 0, chooserSelections: {} },
    ] });
    const apBefore = char.apBudget.total;

    // Two years of Interhigh: AP, height growth, year advances.
    char = characterReducer(char, { type: 'INTERHIGH', season: 'summer', prelimGames: 2, nationalGames: 1, heightGainCm: 0 });
    char = characterReducer(char, { type: 'INTERHIGH', season: 'spring', prelimGames: 3, nationalGames: 0, heightGainCm: 1.5 });
    char = characterReducer(char, { type: 'INTERHIGH', season: 'summer', prelimGames: 1, nationalGames: 0, heightGainCm: 0 });
    expect(char.schoolYear).toBe(2);
    expect(char.physical!.heightCm).toBe(179.5);
    expect(char.apBudget.levelUpGains).toBe(15);

    const next = characterReducer(char, { type: 'SET_LEVEL_UP_MODE', mode: 'weekly' });
    expect(next.levelUpMode).toBe('weekly');
    expect(next.apBudget.levelUpGains).toBe(0);
    expect(next.apBudget.total).toBe(apBefore);
    expect(next.physical!.heightCm).toBe(178);          // back to the table value
    expect(next.reaches!.standingReachCm).toBeCloseTo(1.3 * 178, 5);
    expect(next.schoolYear).toBe(1);                    // back to the rolled year
    expect(next.graduated).toBe(false);
    expect(next.levelUpHistory).toEqual([]);
    expect(next.weeklyMatches).toEqual([]);
    // Abilities are kept, so the meter can read over-budget.
    expect(next.selectedAbilities).toHaveLength(1);
    expect(next.apBudget.spent).toBe(6);                // Training costs 6 AP
    expect(next.apBudget.remaining).toBe(apBefore - 6);
  });

  it('un-graduates a 3rd-year graduate back to their rolled year', () => {
    let char = base({ schoolYear: 3, yearRoll: 3 });
    char = characterReducer(char, { type: 'INTERHIGH', season: 'spring', prelimGames: 0, nationalGames: 4, heightGainCm: 2 });
    expect(char.graduated).toBe(true);

    const next = characterReducer(char, { type: 'SET_LEVEL_UP_MODE', mode: 'weekly' });
    expect(next.graduated).toBe(false);
    expect(next.schoolYear).toBe(3);
    expect(next.physical!.heightCm).toBe(178);
  });

  it('clears a weekly log when switching back to Tournament', () => {
    let char = weekly();
    char = characterReducer(char, { type: 'RECORD_WEEKLY_MATCH', result: 'win', note: 'a' });
    char = characterReducer(char, { type: 'RECORD_WEEKLY_MATCH', result: 'loss', note: 'b' });
    const next = characterReducer(char, { type: 'SET_LEVEL_UP_MODE', mode: 'tournament' });
    expect(next.weeklyMatches).toEqual([]);
    expect(next.apBudget.levelUpGains).toBe(0);
  });

  it('is a no-op when the chosen system is already locked in', () => {
    let char = weekly();
    char = characterReducer(char, { type: 'RECORD_WEEKLY_MATCH', result: 'win', note: 'keep me' });
    const next = characterReducer(char, { type: 'SET_LEVEL_UP_MODE', mode: 'weekly' });
    expect(next).toBe(char);
    expect(weeklyMatchesOf(next)).toHaveLength(1);
  });

  it('starts a seeded run with the picker open and no match log', () => {
    let char = weekly();
    char = characterReducer(char, { type: 'RECORD_WEEKLY_MATCH', result: 'win', note: 'a' });
    const fresh = characterReducer(char, { type: 'START_SEEDED_RUN', seed: 'karasuno-1' });
    expect(fresh.levelUpMode).toBeUndefined();
    expect(fresh.weeklyMatches).toEqual([]);
  });
});

describe('match log CSV', () => {
  it('writes a header, one row per match and a running AP total', () => {
    const char = weekly({ name: 'Shoyo Hinata', weeklyMatches: [
      match({ uid: 'a', result: 'win', apGained: 2, note: 'vs Nekoma' }),
      match({ uid: 'b', result: 'loss', apGained: 1, note: 'vs Aoba Johsai' }),
      match({ uid: 'c', result: 'win', apGained: 2, note: '' }),
    ] });
    const lines = buildWeeklyMatchCsv(char).trim().split('\r\n');
    expect(lines[0]).toBe('Match,Result,AP Gained,Running AP,School Year,Recorded At,Note');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe('1,Win,2,2,1,2026-11-17T10:00:00.000Z,vs Nekoma');
    expect(lines[2]).toBe('2,Loss,1,3,1,2026-11-17T10:00:00.000Z,vs Aoba Johsai');
    expect(lines[3]).toBe('3,Win,2,5,1,2026-11-17T10:00:00.000Z,');
    expect(weeklyCsvFileName(char)).toBe('Shoyo_Hinata-match-log.csv');
  });

  it('quotes notes containing commas, quotes or newlines', () => {
    const char = weekly({ weeklyMatches: [
      match({ uid: 'a', note: 'vs Nekoma, 2-1' }),
      match({ uid: 'b', note: 'he said "nice serve"' }),
      match({ uid: 'c', note: 'line one\nline two' }),
    ] });
    const csv = buildWeeklyMatchCsv(char);
    expect(csv).toContain('"vs Nekoma, 2-1"');
    expect(csv).toContain('"he said ""nice serve"""');
    expect(csv).toContain('"line one\nline two"');
  });

  it('emits just the header for an empty log', () => {
    expect(buildWeeklyMatchCsv(weekly()).trim().split('\r\n')).toHaveLength(1);
  });
});

describe('exports carry the weekly log', () => {
  it('adds a Match Log sheet for weekly characters only', () => {
    const w = weekly({ weeklyMatches: [match()] });
    const sheets = buildCharacterWorkbook(w, null, null).map((s) => s.sheet);
    expect(sheets).toContain('Match Log');

    const t = base({ levelUpMode: 'tournament' });
    expect(buildCharacterWorkbook(t, null, null).map((s) => s.sheet)).not.toContain('Match Log');
  });

  it('records the system and the long-run record in the workbook', () => {
    const w = weekly({ weeklyMatches: [
      match({ uid: 'a', result: 'win', apGained: 2 }),
      match({ uid: 'b', result: 'loss', apGained: 1 }),
    ] });
    const sheets = buildCharacterWorkbook(w, null, null);
    const summary = sheets.find((s) => s.sheet === 'Summary')!;
    const system = summary.data.find((row) => row[0]?.value === 'Level-Up System');
    expect(system?.[1]?.value).toBe('Weekly');

    const log = sheets.find((s) => s.sheet === 'Match Log')!;
    expect(log.data[1].map((c) => c?.value)).toEqual(['1-1', 2, 1, 1, 0.5, 3]);
  });

  it('footnotes the record and recent matches in the Discord block', () => {
    const w = weekly({ name: 'Kei', weeklyMatches: [
      match({ uid: 'a', result: 'win', apGained: 2, note: 'vs Nekoma' }),
      match({ uid: 'b', result: 'loss', apGained: 1, note: 'vs Aoba' }),
      match({ uid: 'c', result: 'win', apGained: 2, note: '' }),
    ] });
    const out = buildDiscordExport(w, null, null);
    expect(out).toContain('[Weekly match log: 2W-1L (67%) · +5 AP over 3 matches]');
    expect(out).toContain('#3 W +2');
    expect(out).toContain('#1 W +2 "vs Nekoma"');
  });

  it('leaves the Discord block untouched for tournament characters', () => {
    expect(buildDiscordExport(base(), null, null)).not.toContain('Weekly match log');
  });
});

describe('persistence', () => {
  function roundTrip(character: Character) {
    const result = adoptCharacter(
      JSON.parse(JSON.stringify(character)) as unknown,
      SCHEMA_VERSION,
      'test',
    );
    expect(result.ok).toBe(true);
    return (result as { ok: true; character: Character }).character;
  }

  it('round-trips the locked system and the match log', () => {
    const w = weekly({ weeklyMatches: [match({ uid: 'a', note: 'vs Nekoma' })] });
    const loaded = roundTrip(w);
    expect(loaded.levelUpMode).toBe('weekly');
    expect(loaded.weeklyMatches).toHaveLength(1);
    expect(loaded.weeklyMatches![0]).toMatchObject({ uid: 'a', result: 'win', note: 'vs Nekoma' });
  });

  it('leaves the picker open for a save with an unknown system', () => {
    const bogus = { ...base(), levelUpMode: 'monthly' } as unknown as Character;
    expect(roundTrip(bogus).levelUpMode).toBeUndefined();
  });

  it('drops malformed match rows and backfills missing fields', () => {
    const messy = {
      ...weekly(),
      weeklyMatches: [
        { result: 'win' },                                  // no uid / note / timestamp
        { result: 'draw', apGained: 9 },                     // unknown result — dropped
        null,                                                // junk — dropped
        { uid: 'c', result: 'loss', apGained: 1, note: 'x', recordedAt: 'z', year: 7 },
      ],
    } as unknown as Character;
    const loaded = roundTrip(messy);
    expect(loaded.weeklyMatches).toHaveLength(2);
    expect(loaded.weeklyMatches![0]).toMatchObject({ result: 'win', apGained: 2, note: '' });
    expect(loaded.weeklyMatches![0].uid).toBeTruthy();
    // An out-of-range school year falls back to 1 rather than poisoning the UI.
    expect(loaded.weeklyMatches![1]).toMatchObject({ uid: 'c', result: 'loss', year: 1 });
  });

  it('gives a pre-feature save an empty log and an open picker', () => {
    const old = { ...base() } as Record<string, unknown>;
    delete old.weeklyMatches;
    delete old.levelUpMode;
    const loaded = roundTrip(old as unknown as Character);
    expect(loaded.weeklyMatches).toEqual([]);
    expect(loaded.levelUpMode).toBeUndefined();
  });
});

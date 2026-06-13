// @vitest-environment jsdom
// src/__tests__/persistenceMigration.test.ts
// Loading a pre-two-event save drops incompatible level-up history but keeps banked AP.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSaved, clearSaved, STORAGE_KEY } from '../state/persistence';
import { INITIAL_CHARACTER } from '../state/characterStore';

function seed(character: unknown) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, savedAt: '2026-01-01T00:00:00.000Z', character }),
  );
}

describe('level-up history migration on load', () => {
  beforeEach(() => clearSaved());

  it('drops old-shape (teamsPlayed) history entries but preserves banked AP', () => {
    const oldChar = {
      ...INITIAL_CHARACTER,
      schoolYear: 2,
      apBudget: { ...INITIAL_CHARACTER.apBudget, levelUpGains: 7, total: 17, remaining: 17 },
      // old record shape — no `season` field
      levelUpHistory: [{ fromYear: 1, toYear: 2, teamsPlayed: 2, apGained: 7, heightGainCm: 0.5 }],
    };
    seed(oldChar);

    const loaded = loadSaved();
    expect(loaded).not.toBeNull();
    expect(loaded!.levelUpHistory).toEqual([]);        // incompatible entries dropped
    expect(loaded!.apBudget.levelUpGains).toBe(7);     // banked AP preserved
    expect(loaded!.schoolYear).toBe(2);                // current year preserved
  });

  it('keeps new-shape (season) history entries intact', () => {
    const newChar = {
      ...INITIAL_CHARACTER,
      schoolYear: 2,
      levelUpHistory: [
        { season: 'summer', year: 1, prelimGames: 1, nationalGames: 0, apGained: 2, heightGainCm: 0 },
        { season: 'spring', year: 1, prelimGames: 2, nationalGames: 1, apGained: 7, heightGainCm: 0.5 },
      ],
    };
    seed(newChar);

    const loaded = loadSaved();
    expect(loaded!.levelUpHistory).toHaveLength(2);
    expect(loaded!.levelUpHistory.map((r) => r.season)).toEqual(['summer', 'spring']);
  });
});

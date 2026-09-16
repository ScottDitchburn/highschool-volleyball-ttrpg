// @vitest-environment jsdom
// src/__tests__/persistenceMigration.test.ts
// Loading a pre-two-event save drops incompatible level-up history but keeps banked AP.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSaved, clearSaved, SCHEMA_VERSION, STORAGE_KEY } from '../state/persistence';
import { INITIAL_CHARACTER } from '../state/characterStore';
import { makePhysicalAttributes } from '../types';

function seed(character: unknown, version = 1) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version, savedAt: '2026-01-01T00:00:00.000Z', character }),
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

// ── v.3 "Height – Vert Jump Modifier" migration (schema v1 → v2) ──────────────

describe('v.3 vertical-jump modifier migration on load', () => {
  beforeEach(() => clearSaved());

  it('recomputes verticalCm and injects verticalModifier for a pre-v.3 save', () => {
    const oldChar = {
      ...INITIAL_CHARACTER,
      physicalPool: { rollA: { dice: [6, 6, 6], total: 18 }, rollB: { dice: [4, 4, 4], total: 12 } },
      // pre-v.3: verticalCm was 45 + 3 × the RAW roll, and no modifier was stored
      physical: { heightRoll: 18, verticalRoll: 12, heightCm: 186, verticalCm: 81 },
      reaches: {
        effectiveHeightCm: 186, standingReachCm: 241.8,
        spikingReachCm: 322.8, blockingReachCm: 310.65, blockingCoef: 0.85,
      },
    };
    seed(oldChar, 1);

    const loaded = loadSaved();
    expect(loaded).not.toBeNull();
    // v.3: height roll 18 → modifier −5, so the effective vertical roll is 7.
    expect(loaded!.physical!.verticalModifier).toBe(-5);
    expect(loaded!.physical!.verticalCm).toBe(66);   // 45 + 3×7 (was 81)
    expect(loaded!.physical!.verticalRoll).toBe(12); // raw roll preserved
    expect(loaded!.physical!.heightCm).toBe(186);    // height untouched
    // cached reaches refreshed off the corrected vertical
    expect(loaded!.reaches!.spikingReachCm).toBeCloseTo(241.8 + 66, 10);
    expect(loaded!.reaches!.blockingReachCm).toBeCloseTo(241.8 + 0.85 * 66, 10);
    expect(loaded!.reaches!.standingReachCm).toBeCloseTo(241.8, 10);
  });

  it('preserves accrued Interhigh height growth (cm) while correcting the vertical', () => {
    const oldChar = {
      ...INITIAL_CHARACTER,
      // heightCm carries +1.2 cm of level-up growth that the roll does not encode
      physical: { heightRoll: 18, verticalRoll: 12, heightCm: 187.2, verticalCm: 81 },
    };
    seed(oldChar, 1);

    const loaded = loadSaved();
    expect(loaded!.physical!.heightCm).toBe(187.2);
    expect(loaded!.physical!.verticalCm).toBe(66);
  });

  it('keeps a Swing Block character on its 0.9 blocking coefficient', () => {
    const oldChar = {
      ...INITIAL_CHARACTER,
      physical: { heightRoll: 18, verticalRoll: 12, heightCm: 186, verticalCm: 81 },
      reaches: {
        effectiveHeightCm: 186, standingReachCm: 241.8,
        spikingReachCm: 322.8, blockingReachCm: 314.7, blockingCoef: 0.9,
      },
    };
    seed(oldChar, 1);

    const loaded = loadSaved();
    expect(loaded!.reaches!.blockingCoef).toBe(0.9);
    expect(loaded!.reaches!.blockingReachCm).toBeCloseTo(241.8 + 0.9 * 66, 10);
  });

  it('is a no-op for an already-migrated v2 save', () => {
    const newChar = {
      ...INITIAL_CHARACTER,
      physical: makePhysicalAttributes(18, 12), // 186 cm / 66 cm, mod −5
    };
    seed(newChar, SCHEMA_VERSION);

    const loaded = loadSaved();
    expect(loaded!.physical).toEqual(makePhysicalAttributes(18, 12));
  });

  it('leaves a save with no assigned physical attributes alone', () => {
    seed({ ...INITIAL_CHARACTER, physical: null }, 1);
    expect(loadSaved()!.physical).toBeNull();
  });

  it('rejects an unknown (future) schema version', () => {
    seed(INITIAL_CHARACTER, 99);
    expect(loadSaved()).toBeNull();
  });
});

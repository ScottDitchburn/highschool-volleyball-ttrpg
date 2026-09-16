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

// ── Physical-attribute migration (schema v1/v2 → v3) ─────────────────────────
//
// v1: verticalCm came from the RAW vertical roll and there was no modifier.
// v1/v2: both roll→cm conversions were off from the printed Physical Attributes
//        Table (height 150 + 2×roll instead of 148 + 2×roll, vertical 45 + 3×roll
//        instead of 39 + 3×roll).
// Table values for height roll 18 / raw vertical roll 12: 184 cm, modifier −5,
// effective vertical roll 7 → 60 cm.

describe('physical-attribute migration on load', () => {
  beforeEach(() => clearSaved());

  it('corrects a v1 save: modifier injected, both columns recomputed', () => {
    const oldChar = {
      ...INITIAL_CHARACTER,
      physicalPool: { rollA: { dice: [6, 6, 6], total: 18 }, rollB: { dice: [4, 4, 4], total: 12 } },
      // v1: heightCm = 150 + 2×18, verticalCm = 45 + 3×12 (raw roll), no modifier
      physical: { heightRoll: 18, verticalRoll: 12, heightCm: 186, verticalCm: 81 },
      reaches: {
        effectiveHeightCm: 186, standingReachCm: 241.8,
        spikingReachCm: 322.8, blockingReachCm: 310.65, blockingCoef: 0.85,
      },
    };
    seed(oldChar, 1);

    const loaded = loadSaved();
    expect(loaded).not.toBeNull();
    expect(loaded!.physical!.verticalModifier).toBe(-5);
    expect(loaded!.physical!.heightCm).toBe(184);   // table: 148 + 2×18 (was 186)
    expect(loaded!.physical!.verticalCm).toBe(60);  // table: 39 + 3×7   (was 81)
    expect(loaded!.physical!.heightRoll).toBe(18);  // rolls preserved
    expect(loaded!.physical!.verticalRoll).toBe(12);
    // cached reaches refreshed off the corrected values
    expect(loaded!.reaches!.standingReachCm).toBeCloseTo(1.3 * 184, 10);
    expect(loaded!.reaches!.spikingReachCm).toBeCloseTo(1.3 * 184 + 60, 10);
    expect(loaded!.reaches!.blockingReachCm).toBeCloseTo(1.3 * 184 + 0.85 * 60, 10);
  });

  it('corrects a v2 save (modifier already applied, cm conversions still wrong)', () => {
    const v2Char = {
      ...INITIAL_CHARACTER,
      // v2: modifier was applied, but with the old conversions (150+2r / 45+3r)
      physical: { heightRoll: 18, verticalRoll: 12, heightCm: 186, verticalModifier: -5, verticalCm: 66 },
    };
    seed(v2Char, 2);

    const loaded = loadSaved();
    expect(loaded!.physical!.heightCm).toBe(184);
    expect(loaded!.physical!.verticalCm).toBe(60);
    expect(loaded!.physical!.verticalModifier).toBe(-5);
  });

  it('preserves accrued Interhigh height growth (cm) across the correction', () => {
    const oldChar = {
      ...INITIAL_CHARACTER,
      // 186 base + 1.2 cm of level-up growth that the roll does not encode
      physical: { heightRoll: 18, verticalRoll: 12, heightCm: 187.2, verticalCm: 81 },
    };
    seed(oldChar, 1);

    const loaded = loadSaved();
    expect(loaded!.physical!.heightCm).toBe(185.2); // corrected base 184 + 1.2 growth
    expect(loaded!.physical!.verticalCm).toBe(60);
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
    expect(loaded!.reaches!.blockingReachCm).toBeCloseTo(1.3 * 184 + 0.9 * 60, 10);
  });

  it('is a no-op for an already-migrated current-schema save', () => {
    const newChar = {
      ...INITIAL_CHARACTER,
      physical: makePhysicalAttributes(18, 12), // 184 cm / 60 cm, mod −5
    };
    seed(newChar, SCHEMA_VERSION);

    const loaded = loadSaved();
    expect(loaded!.physical).toEqual(makePhysicalAttributes(18, 12));
  });

  it('keeps growth intact on a current-schema save (no double correction)', () => {
    const newChar = {
      ...INITIAL_CHARACTER,
      physical: { ...makePhysicalAttributes(18, 12), heightCm: 185.2 },
    };
    seed(newChar, SCHEMA_VERSION);

    expect(loadSaved()!.physical!.heightCm).toBe(185.2);
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

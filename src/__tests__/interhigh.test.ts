// src/__tests__/interhigh.test.ts
// Two-event (Summer / Spring Interhigh) level-up reducer behaviour.
import { describe, it, expect } from 'vitest';
import { characterReducer, INITIAL_CHARACTER } from '../state/characterStore';
import type { Character, PhysicalAttributes } from '../types';

function withPhysical(overrides: Partial<Character> = {}): Character {
  const physical: PhysicalAttributes = {
    heightRoll: 15, verticalRoll: 15, heightCm: 180, verticalCm: 90,
  };
  return { ...INITIAL_CHARACTER, schoolYear: 1, physical, ...overrides };
}

describe('Summer Interhigh', () => {
  it('awards (2×prelim)+(3×national) AP, no year advance, no height, records the event', () => {
    const start = withPhysical();
    const next = characterReducer(start, {
      type: 'INTERHIGH', season: 'summer', prelimGames: 2, nationalGames: 1, heightGainCm: 0,
    });
    expect(next.apBudget.levelUpGains).toBe(7);        // 2*2 + 3*1
    expect(next.apBudget.total).toBe(start.apBudget.total + 7);
    expect(next.schoolYear).toBe(1);                   // no advance
    expect(next.physical!.heightCm).toBe(180);         // no height growth
    expect(next.graduated).toBeFalsy();
    expect(next.levelUpHistory).toHaveLength(1);
    expect(next.levelUpHistory[0]).toMatchObject({
      season: 'summer', year: 1, prelimGames: 2, nationalGames: 1, apGained: 7, heightGainCm: 0,
    });
  });

  it('allows 0-game events (0 AP)', () => {
    const next = characterReducer(withPhysical(), {
      type: 'INTERHIGH', season: 'summer', prelimGames: 0, nationalGames: 0, heightGainCm: 0,
    });
    expect(next.apBudget.levelUpGains).toBe(0);
    expect(next.levelUpHistory[0].apGained).toBe(0);
  });
});

describe('Spring Interhigh', () => {
  it('awards AP, applies height growth, and advances a 1st-year to 2nd', () => {
    const next = characterReducer(withPhysical(), {
      type: 'INTERHIGH', season: 'spring', prelimGames: 3, nationalGames: 2, heightGainCm: 1.5,
    });
    expect(next.apBudget.levelUpGains).toBe(12);       // 2*3 + 3*2
    expect(next.schoolYear).toBe(2);
    expect(next.physical!.heightCm).toBe(181.5);
    expect(next.graduated).toBeFalsy();
    expect(next.levelUpHistory[0]).toMatchObject({ season: 'spring', year: 1, heightGainCm: 1.5 });
  });

  it('is gated behind Summer in the year only via UI; reducer still records each event with its year', () => {
    let char = withPhysical();
    char = characterReducer(char, { type: 'INTERHIGH', season: 'summer', prelimGames: 1, nationalGames: 0, heightGainCm: 0 });
    char = characterReducer(char, { type: 'INTERHIGH', season: 'spring', prelimGames: 1, nationalGames: 0, heightGainCm: 0.4 });
    expect(char.schoolYear).toBe(2);
    expect(char.levelUpHistory.map((r) => r.season)).toEqual(['summer', 'spring']);
    expect(char.levelUpHistory.map((r) => r.year)).toEqual([1, 1]);
  });
});

describe('3rd-year Spring → graduation', () => {
  it('awards AP + height, sets graduated, and keeps the year at 3', () => {
    const start = withPhysical({ schoolYear: 3 });
    const next = characterReducer(start, {
      type: 'INTERHIGH', season: 'spring', prelimGames: 4, nationalGames: 3, heightGainCm: 2.0,
    });
    expect(next.apBudget.levelUpGains).toBe(17);       // 2*4 + 3*3
    expect(next.schoolYear).toBe(3);                   // no 4th year
    expect(next.graduated).toBe(true);
    expect(next.physical!.heightCm).toBe(182);
    expect(next.levelUpHistory[0]).toMatchObject({ season: 'spring', year: 3, graduated: true });
  });
});

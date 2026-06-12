// Regression: Growth Spurt (+8 cm) must raise the effective height exposed to the
// character sheet, not just the reaches.
import { describe, it, expect } from 'vitest';
import { computeDerived, INITIAL_CHARACTER } from '../state/characterStore';
import { rollToHeightCm, rollToVerticalCm, type Character } from '../types';

function charWith(abilityIds: string[]): Character {
  const heightRoll = 18, verticalRoll = 12;
  const heightCm = rollToHeightCm(heightRoll);     // 186
  const verticalCm = rollToVerticalCm(verticalRoll); // 81
  return {
    ...INITIAL_CHARACTER,
    physical: { heightRoll, verticalRoll, heightCm, verticalCm },
    selectedAbilities: abilityIds.map((id, i) => ({ uid: 'u' + i, abilityId: id, tier: 0, chooserSelections: {} })),
  };
}

describe('effective height', () => {
  it('base height when no height abilities', () => {
    const d = computeDerived(charWith([]));
    expect(d?.effectiveHeightCm).toBe(186);
  });

  it('Growth Spurt adds +8 cm to effective height and standing reach', () => {
    const base = computeDerived(charWith([]))!;
    const spurt = computeDerived(charWith(['growth-spurt']))!;
    expect(spurt.effectiveHeightCm).toBe(194);                  // 186 + 8
    expect(spurt.standingReachCm).toBeCloseTo(1.3 * 194, 5);    // reach uses effective height
    expect(spurt.standingReachCm).toBeGreaterThan(base.standingReachCm);
  });
});

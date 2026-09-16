// Regression: Growth Spurt (+8 cm) must raise the effective height exposed to the
// character sheet, not just the reaches.
import { describe, it, expect } from 'vitest';
import { computeDerived, INITIAL_CHARACTER } from '../state/characterStore';
import { makePhysicalAttributes, type Character } from '../types';

function charWith(abilityIds: string[]): Character {
  // v.3: height roll 18 carries a -5 vert modifier, so raw vertical roll 12
  // becomes an effective roll of 7 => 66 cm (was 81 cm pre-v.3).
  const physical = makePhysicalAttributes(18, 12); // 186 cm / 66 cm, mod -5
  return {
    ...INITIAL_CHARACTER,
    physical,
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

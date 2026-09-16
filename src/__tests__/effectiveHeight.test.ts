// Regression: Growth Spurt (+8 cm) must raise the effective height exposed to the
// character sheet, not just the reaches.
import { describe, it, expect } from 'vitest';
import { computeDerived, INITIAL_CHARACTER } from '../state/characterStore';
import { makePhysicalAttributes, type Character } from '../types';

function charWith(abilityIds: string[]): Character {
  // Physical Attributes Table: height roll 18 -> 184 cm (148 + 2*18).
  // v.3: that roll carries a -5 vert modifier, so raw vertical roll 12 becomes
  // an effective roll of 7 => 60 cm (39 + 3*7).
  const physical = makePhysicalAttributes(18, 12); // 184 cm / 60 cm, mod -5
  return {
    ...INITIAL_CHARACTER,
    physical,
    selectedAbilities: abilityIds.map((id, i) => ({ uid: 'u' + i, abilityId: id, tier: 0, chooserSelections: {} })),
  };
}

describe('effective height', () => {
  it('base height when no height abilities', () => {
    const d = computeDerived(charWith([]));
    expect(d?.effectiveHeightCm).toBe(184);
  });

  it('Growth Spurt adds +8 cm to effective height and standing reach', () => {
    const base = computeDerived(charWith([]))!;
    const spurt = computeDerived(charWith(['growth-spurt']))!;
    expect(spurt.effectiveHeightCm).toBe(192);                  // 184 + 8
    expect(spurt.standingReachCm).toBeCloseTo(1.3 * 192, 5);    // reach uses effective height
    expect(spurt.standingReachCm).toBeGreaterThan(base.standingReachCm);
  });
});

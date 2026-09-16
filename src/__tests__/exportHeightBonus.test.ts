// Regression: Growth Spurt (+8 cm) must show in the Discord/PDF height (effective, not base).
import { describe, it, expect } from 'vitest';
import { buildDiscordExport } from '../export/discord';
import { computeDerived, INITIAL_CHARACTER } from '../state/characterStore';
import { makePhysicalAttributes, type Character } from '../types';

function charWithGrowthSpurt(): Character {
  // Physical Attributes Table: height roll 18 -> 184 cm; v.3 modifier -5 puts the
  // raw vertical roll 12 at an effective 7 -> 60 cm.
  return {
    ...INITIAL_CHARACTER,
    physical: makePhysicalAttributes(18, 12), // 184 cm / 60 cm, mod -5
    selectedAbilities: [{ uid: 'u1', abilityId: 'growth-spurt', tier: 0, chooserSelections: {} }],
  };
}

describe('export height reflects Growth Spurt', () => {
  it('Discord height shows the effective (boosted) height, not the base', () => {
    const c = charWithGrowthSpurt();
    const derived = computeDerived(c);
    expect(derived?.effectiveHeightCm).toBe(192); // 184 + 8
    const text = buildDiscordExport(c, null, derived);
    expect(text).toMatch(/Height: 192\.0 cm/);
    expect(text).toMatch(/\(\+8\.0\)/);
    expect(text).not.toMatch(/Height: 184\.0 cm/);
  });
});

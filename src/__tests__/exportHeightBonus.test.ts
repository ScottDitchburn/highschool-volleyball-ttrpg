// Regression: Growth Spurt (+8 cm) must show in the Discord/PDF height (effective, not base).
import { describe, it, expect } from 'vitest';
import { buildDiscordExport } from '../export/discord';
import { computeDerived, INITIAL_CHARACTER } from '../state/characterStore';
import { rollToHeightCm, rollToVerticalCm, type Character } from '../types';

function charWithGrowthSpurt(): Character {
  const heightCm = rollToHeightCm(18);   // 186
  const verticalCm = rollToVerticalCm(12); // 81
  return {
    ...INITIAL_CHARACTER,
    physical: { heightRoll: 18, verticalRoll: 12, heightCm, verticalCm },
    selectedAbilities: [{ uid: 'u1', abilityId: 'growth-spurt', tier: 0, chooserSelections: {} }],
  };
}

describe('export height reflects Growth Spurt', () => {
  it('Discord height shows the effective (boosted) height, not the base', () => {
    const c = charWithGrowthSpurt();
    const derived = computeDerived(c);
    expect(derived?.effectiveHeightCm).toBe(194); // 186 + 8
    const text = buildDiscordExport(c, null, derived);
    expect(text).toMatch(/Height: 194\.0 cm/);
    expect(text).toMatch(/\(\+8\.0\)/);
    expect(text).not.toMatch(/Height: 186\.0 cm/);
  });
});

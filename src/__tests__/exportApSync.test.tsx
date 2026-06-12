// Regression: Print & Discord exports must reflect live AP spent/remaining
// (the stored character.apBudget.spent/remaining is NOT kept in sync with abilities).
import { describe, it, expect } from 'vitest';
import { buildDiscordExport } from '../export/discord';
import { computeAPBudget } from '../engine/apEngine';
import { INITIAL_CHARACTER } from '../state/characterStore';
import type { Character } from '../types';

function charWithAbility(): Character {
  return {
    ...INITIAL_CHARACTER,
    // stale stored budget (as it would be after selecting abilities)
    apBudget: { base: 10, yearBonus: 0, experienceBonus: 0, levelUpGains: 0, total: 10, spent: 0, remaining: 10 },
    selectedAbilities: [{ uid: 'u1', abilityId: 'block-breaker', tier: 1, chooserSelections: {} }], // 3 AP
  };
}

describe('exports reflect live AP', () => {
  it('computeAPBudget reports the spent/remaining the exports should use', () => {
    const b = computeAPBudget(charWithAbility());
    expect(b.spent).toBe(3);
    expect(b.remaining).toBe(7);
    expect(b.total).toBe(10);
  });

  it('Discord export shows live spent/remaining, not the stale stored 0', () => {
    const text = buildDiscordExport(charWithAbility(), null, null);
    expect(text).toMatch(/3 spent/);
    expect(text).toMatch(/7 remaining/);
    expect(text).not.toMatch(/0 spent/);
  });
});

// src/__tests__/apEngine.test.ts
import { describe, it, expect } from 'vitest';
import type { Character, APBudget, SelectedAbility } from '../types';
import { computeSpent, apIncomeTotal, apRemaining, computeAPBudget } from '../engine/apEngine';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBudget(overrides: Partial<APBudget> = {}): APBudget {
  return {
    base: 10,
    yearBonus: 0,
    experienceBonus: 0,
    levelUpGains: 0,
    total: 10,
    spent: 0,
    remaining: 10,
    ...overrides,
  };
}

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    name: 'Test',
    schoolYear: 1,
    physicalPool: { rollA: null, rollB: null },
    physical: null,
    reaches: null,
    skillPool: { rolls: Array(10).fill(null) },
    skills: null,
    yearRoll: null,
    experience: null,
    apBudget: makeBudget(),
    selectedAbilities: [],
    levelUpHistory: [],
    seed: null,
    seeded: false,
    ...overrides,
  };
}

function makeSel(abilityId: string, tier = 0, uid = 'uid-' + abilityId): SelectedAbility {
  return { uid, abilityId, tier, chooserSelections: {} };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('apIncomeTotal', () => {
  it('1st year, no experience: income = 10', () => {
    const char = makeChar();
    expect(apIncomeTotal(char)).toBe(10);
  });

  it('2nd year with yearBonus=8 (3+2d4 roll of 5) and expBonus=2: income = 10+8+2+0 = 20', () => {
    const char = makeChar({
      schoolYear: 2,
      apBudget: makeBudget({ yearBonus: 8, experienceBonus: 2, total: 20 }),
    });
    expect(apIncomeTotal(char)).toBe(20);
  });

  it('3rd year with yearBonus=14 (6+4d4 roll=8) and expBonus=4 and levelUp=7: total = 10+14+4+7 = 35', () => {
    const char = makeChar({
      schoolYear: 3,
      apBudget: makeBudget({ yearBonus: 14, experienceBonus: 4, levelUpGains: 7, total: 35 }),
    });
    expect(apIncomeTotal(char)).toBe(35);
  });

  it('levelUpGains are included: base + gains', () => {
    const char = makeChar({
      apBudget: makeBudget({ levelUpGains: 5, total: 15 }),
    });
    expect(apIncomeTotal(char)).toBe(15);
  });
});

describe('computeSpent', () => {
  it('no abilities selected: spent = 0', () => {
    const char = makeChar();
    expect(computeSpent(char)).toBe(0);
  });

  it('single non-tiered ability (fan, baseCost=1, tier=0): spent = 1', () => {
    const char = makeChar({ selectedAbilities: [makeSel('fan', 0)] });
    expect(computeSpent(char)).toBe(1);
  });

  it('training (baseCost=5, tier=0): spent = 5', () => {
    const char = makeChar({ selectedAbilities: [makeSel('training', 0)] });
    expect(computeSpent(char)).toBe(5);
  });

  it('two training instances: spent = 10', () => {
    const char = makeChar({
      selectedAbilities: [
        makeSel('training', 0, 'uid-a'),
        makeSel('training', 0, 'uid-b'),
      ],
    });
    expect(computeSpent(char)).toBe(10);
  });

  it('jump-serve at tier 1 (baseCost=3 + tiers[0].addCost=0): spent = 3', () => {
    // Selecting at tier=1 means slice(0,1) = tiers[0] with addCost 0
    const char = makeChar({ selectedAbilities: [makeSel('jump-serve', 1)] });
    expect(computeSpent(char)).toBe(3);
  });

  it('jump-serve at tier 3 (baseCost=3 + tiers[0]+[1]+[2] = 0+1+2 = 3): spent = 6', () => {
    const char = makeChar({ selectedAbilities: [makeSel('jump-serve', 3)] });
    // tiers[0]=0, tiers[1]=1, tiers[2]=2, sum=3. baseCost=3. Total=6.
    expect(computeSpent(char)).toBe(6);
  });

  it('jump-serve tier 5 (max, all addCosts): baseCost=3 + (0+1+2+3+4) = 13', () => {
    const char = makeChar({ selectedAbilities: [makeSel('jump-serve', 5)] });
    expect(computeSpent(char)).toBe(13);
  });

  it('multiple different abilities sum correctly', () => {
    // training(5) + fan(1) + boom-jump-technique(4)
    const char = makeChar({
      selectedAbilities: [
        makeSel('training', 0, 'u1'),
        makeSel('fan', 0, 'u2'),
        makeSel('boom-jump-technique', 0, 'u3'),
      ],
    });
    expect(computeSpent(char)).toBe(10);
  });

  it('fan repeats at a flat 1 AP per copy: three copies = 3 AP', () => {
    const char = makeChar({
      selectedAbilities: [
        makeSel('fan', 0, 'f1'),
        makeSel('fan', 0, 'f2'),
        makeSel('fan', 0, 'f3'),
      ],
    });
    expect(computeSpent(char)).toBe(3);
  });

  it('unknown ability id is skipped gracefully', () => {
    const char = makeChar({ selectedAbilities: [makeSel('nonexistent-id', 0)] });
    expect(computeSpent(char)).toBe(0);
  });
});

describe('apRemaining', () => {
  it('no spend: remaining = income', () => {
    const char = makeChar();
    expect(apRemaining(char)).toBe(10);
  });

  it('spent 5 of 10: remaining = 5', () => {
    const char = makeChar({ selectedAbilities: [makeSel('training', 0)] });
    expect(apRemaining(char)).toBe(5);
  });

  it('remaining is never negative when AP budget is tight (result can go negative — no clamping)', () => {
    // Spend more than available: ensure the function returns a number (not NaN / undefined).
    // The engine does NOT clamp — over-spending is tracked as negative remaining.
    const char = makeChar({
      selectedAbilities: [
        makeSel('training', 0, 'u1'),
        makeSel('training', 0, 'u2'),
        makeSel('training', 0, 'u3'), // 15 spent out of 10
      ],
    });
    const rem = apRemaining(char);
    expect(typeof rem).toBe('number');
    expect(isNaN(rem)).toBe(false);
    expect(rem).toBe(-5); // overspent by 5
  });
});

describe('computeAPBudget', () => {
  it('round-trips: total = base + yearBonus + experienceBonus + levelUpGains', () => {
    const char = makeChar({
      schoolYear: 2,
      apBudget: makeBudget({ yearBonus: 8, experienceBonus: 2, total: 20 }),
      selectedAbilities: [makeSel('fan', 0)],
    });
    const budget = computeAPBudget(char);
    expect(budget.total).toBe(20);
    expect(budget.spent).toBe(1);
    expect(budget.remaining).toBe(19);
  });
});

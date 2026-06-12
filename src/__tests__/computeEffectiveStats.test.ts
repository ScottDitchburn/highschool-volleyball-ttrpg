// src/__tests__/computeEffectiveStats.test.ts
import { describe, it, expect } from 'vitest';
import type { Character, APBudget, SkillStats, SelectedAbility, PhysicalAttributes } from '../types';
import { computeEffectiveStats, computeDerived } from '../state/characterStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBudget(overrides: Partial<APBudget> = {}): APBudget {
  return {
    base: 10, yearBonus: 0, experienceBonus: 0, levelUpGains: 0,
    total: 10, spent: 0, remaining: 10, ...overrides,
  };
}

function allStats(val: number): SkillStats {
  return {
    Spike: val, Serve: val, Pass: val, Dig: val, Set: val,
    Block: val, Speed: val, Power: val, IQ: val, Stamina: val,
  };
}

function makePhysical(heightCm: number, verticalCm: number): PhysicalAttributes {
  // Reverse-engineer rolls (not used for computation but needed by the type)
  return {
    heightRoll: Math.round((heightCm - 150) / 2),
    verticalRoll: Math.round((verticalCm - 45) / 3),
    heightCm,
    verticalCm,
  };
}

function makeSel(
  abilityId: string,
  tier = 0,
  uid = 'uid-' + abilityId,
  chooserSelections: SelectedAbility['chooserSelections'] = {},
): SelectedAbility {
  return { uid, abilityId, tier, chooserSelections };
}

function makeChar(
  skills: SkillStats | null,
  abilities: SelectedAbility[],
  physical: PhysicalAttributes | null = null,
): Character {
  return {
    name: 'Test', schoolYear: 1,
    physicalPool: { rollA: null, rollB: null },
    physical,
    reaches: null,
    skillPool: { rolls: Array(10).fill(null) },
    skills,
    yearRoll: null, experience: null,
    apBudget: makeBudget(),
    selectedAbilities: abilities,
    levelUpHistory: [],
    seed: null,
    seeded: false,
  };
}

// ── computeEffectiveStats ─────────────────────────────────────────────────────

describe('computeEffectiveStats', () => {
  it('returns null when skills not yet assigned', () => {
    const char = makeChar(null, []);
    expect(computeEffectiveStats(char)).toBeNull();
  });

  it('returns base stats unchanged when no abilities selected', () => {
    const skills = allStats(2.5);
    const char = makeChar(skills, []);
    const eff = computeEffectiveStats(char);
    expect(eff).toEqual(skills);
  });

  it('two Training instances on different stats both apply +0.25 each', () => {
    const skills = allStats(2.0);
    const abilities = [
      makeSel('training', 0, 'uid-a', { 0: 'Spike' }),
      makeSel('training', 0, 'uid-b', { 0: 'Pass' }),
    ];
    const char = makeChar(skills, abilities);
    const eff = computeEffectiveStats(char)!;
    expect(eff.Spike).toBeCloseTo(2.25, 10);
    expect(eff.Pass).toBeCloseTo(2.25, 10);
    // Other stats unchanged
    expect(eff.Serve).toBe(2.0);
    expect(eff.Dig).toBe(2.0);
  });

  it('Training on same stat twice adds +0.5 total', () => {
    const skills = allStats(2.0);
    const abilities = [
      makeSel('training', 0, 'uid-a', { 0: 'Power' }),
      makeSel('training', 0, 'uid-b', { 0: 'Power' }),
    ];
    const char = makeChar(skills, abilities);
    const eff = computeEffectiveStats(char)!;
    expect(eff.Power).toBeCloseTo(2.5, 10);
  });

  it('Training with no chooser selection is skipped (no change)', () => {
    const skills = allStats(2.0);
    const abilities = [makeSel('training', 0, 'uid-a', {})]; // no chooserSelections
    const char = makeChar(skills, abilities);
    const eff = computeEffectiveStats(char)!;
    expect(eff).toEqual(skills);
  });

  it('new-technique applies -0.25 Spike and -0.25 Serve unconditionally', () => {
    // new-technique has yearlyOnly prereq but computeEffectiveStats doesn't check prereqs
    const skills = { ...allStats(2.0), Spike: 3.0, Serve: 3.0 };
    // new-technique: tier=0 (no tiers), effects: [{stat:'Spike',delta:-0.25},{stat:'Serve',delta:-0.25}]
    const abilities = [makeSel('new-technique', 0, 'uid-nt', {})];
    const char = makeChar(skills, abilities);
    const eff = computeEffectiveStats(char)!;
    expect(eff.Spike).toBeCloseTo(2.75, 10);
    expect(eff.Serve).toBeCloseTo(2.75, 10);
  });
});

// ── computeDerived ─────────────────────────────────────────────────────────────

describe('computeDerived', () => {
  it('returns null when physical not assigned', () => {
    const char = makeChar(null, [], null);
    expect(computeDerived(char)).toBeNull();
  });

  it('baseline: no abilities applied — uses default coef 0.85', () => {
    // heightCm=180, verticalCm=90
    const physical = makePhysical(180, 90);
    const char = makeChar(null, [], physical);
    const d = computeDerived(char)!;
    expect(d.standingReachCm).toBeCloseTo(1.3 * 180, 10);           // 234
    expect(d.spikingReachCm).toBeCloseTo(1.3 * 180 + 90, 10);       // 324
    expect(d.blockingReachCm).toBeCloseTo(1.3 * 180 + 0.85 * 90, 10); // 310.5
    expect(d.blockingCoef).toBe(0.85);
  });

  it('Growth Spurt: +8 cm to effective height, shifts all reaches', () => {
    const physical = makePhysical(180, 90);
    // growth-spurt: { kind: 'heightDelta', cm: 8 }
    const abilities = [makeSel('growth-spurt', 0)];
    const char = makeChar(null, abilities, physical);
    const d = computeDerived(char)!;
    const effH = 180 + 8; // 188
    expect(d.standingReachCm).toBeCloseTo(1.3 * effH, 10);              // 244.4
    expect(d.spikingReachCm).toBeCloseTo(1.3 * effH + 90, 10);          // 334.4
    expect(d.blockingReachCm).toBeCloseTo(1.3 * effH + 0.85 * 90, 10);  // 320.9
  });

  it('Swing Block: overrides blockingCoef to 0.9', () => {
    const physical = makePhysical(180, 90);
    // swing-block: { kind: 'overrideBlockingCoef', value: 0.9 }
    const abilities = [makeSel('swing-block', 0)];
    const char = makeChar(null, abilities, physical);
    const d = computeDerived(char)!;
    expect(d.blockingCoef).toBe(0.9);
    expect(d.blockingReachCm).toBeCloseTo(1.3 * 180 + 0.9 * 90, 10); // 315
    // Standing reach is unchanged
    expect(d.standingReachCm).toBeCloseTo(1.3 * 180, 10);
  });

  it('Boom Jump Technique: +6 cm to spiking reach only', () => {
    const physical = makePhysical(180, 90);
    // boom-jump-technique: { kind: 'spikingReachDelta', cm: 6 }
    const abilities = [makeSel('boom-jump-technique', 0)];
    const char = makeChar(null, abilities, physical);
    const d = computeDerived(char)!;
    expect(d.spikingReachCm).toBeCloseTo(1.3 * 180 + 90 + 6, 10); // 330
    // Standing and blocking unaffected
    expect(d.standingReachCm).toBeCloseTo(1.3 * 180, 10);
    expect(d.blockingReachCm).toBeCloseTo(1.3 * 180 + 0.85 * 90, 10);
  });

  it('Growth Spurt + Swing Block + Boom Jump all compose correctly', () => {
    const physical = makePhysical(180, 90);
    const abilities = [
      makeSel('growth-spurt', 0, 'u1'),
      makeSel('swing-block', 0, 'u2'),
      makeSel('boom-jump-technique', 0, 'u3'),
    ];
    const char = makeChar(null, abilities, physical);
    const d = computeDerived(char)!;
    const effH = 188;
    expect(d.standingReachCm).toBeCloseTo(1.3 * effH, 10);
    expect(d.spikingReachCm).toBeCloseTo(1.3 * effH + 90 + 6, 10);
    expect(d.blockingReachCm).toBeCloseTo(1.3 * effH + 0.9 * 90, 10);
    expect(d.blockingCoef).toBe(0.9);
  });
});

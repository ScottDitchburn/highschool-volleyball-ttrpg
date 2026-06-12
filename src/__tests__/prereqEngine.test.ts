// src/__tests__/prereqEngine.test.ts
import { describe, it, expect } from 'vitest';
import type { Character, SelectedAbility, SkillStats, DerivedReaches, APBudget } from '../types';
import {
  cumulativeCost,
  evaluatePrereq,
  evaluateAbility,
} from '../engine/prereqEngine';
import { ABILITY_MAP } from '../data/abilities';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBudget(overrides: Partial<APBudget> = {}): APBudget {
  return {
    base: 10, yearBonus: 0, experienceBonus: 0, levelUpGains: 0,
    total: 10, spent: 0, remaining: 10, ...overrides,
  };
}

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    name: 'Test', schoolYear: 1,
    physicalPool: { rollA: null, rollB: null },
    physical: null, reaches: null,
    skillPool: { rolls: Array(10).fill(null) },
    skills: null, yearRoll: null, experience: null,
    apBudget: makeBudget(),
    selectedAbilities: [], levelUpHistory: [],
    ...overrides,
  };
}

function allStats(val: number): SkillStats {
  return {
    Spike: val, Serve: val, Pass: val, Dig: val, Set: val,
    Block: val, Speed: val, Power: val, IQ: val, Stamina: val,
  };
}

function makeSel(abilityId: string, tier = 0, uid = 'uid-' + abilityId): SelectedAbility {
  return { uid, abilityId, tier, chooserSelections: {} };
}

function makeDerived(overrides: Partial<DerivedReaches> = {}): DerivedReaches {
  return {
    effectiveHeightCm: 210,
    standingReachCm: 273, spikingReachCm: 363, blockingReachCm: 337.5,
    blockingCoef: 0.85, ...overrides,
  };
}

// ── cumulativeCost ─────────────────────────────────────────────────────────────

describe('cumulativeCost', () => {
  it('tier 0 = baseCost only', () => {
    const ability = ABILITY_MAP['jump-serve']; // baseCost=3
    expect(cumulativeCost(ability, 0)).toBe(3);
  });

  it('tier 1 = baseCost + tiers[0].addCost (jump-serve: 3 + 0 = 3)', () => {
    const ability = ABILITY_MAP['jump-serve'];
    expect(cumulativeCost(ability, 1)).toBe(3);
  });

  it('tier 3 = baseCost + tiers[0]+[1]+[2] (jump-serve: 3+0+1+2 = 6)', () => {
    const ability = ABILITY_MAP['jump-serve'];
    expect(cumulativeCost(ability, 3)).toBe(6);
  });

  it('tier 5 (max for jump-serve): baseCost + 0+1+2+3+4 = 13', () => {
    const ability = ABILITY_MAP['jump-serve'];
    expect(cumulativeCost(ability, 5)).toBe(13);
  });

  it('setter-dumps: non-monotonic — Tier V addCost 2 < Tier IV addCost 4', () => {
    const ability = ABILITY_MAP['setter-dumps']; // baseCost=2
    // tiers: [0,1,3,4,2] (addCosts I-V)
    const costTier4 = cumulativeCost(ability, 4); // base + 0+1+3+4 = 10
    const costTier5 = cumulativeCost(ability, 5); // base + 0+1+3+4+2 = 12
    expect(costTier4).toBe(10);
    expect(costTier5).toBe(12);
    // Tier V addCost is 2 which is less than tier IV's 4 — cumulative still increases
    expect(costTier5).toBeGreaterThan(costTier4);
  });

  it('non-tiered ability: cumulativeCost at any tier = baseCost', () => {
    const ability = ABILITY_MAP['fan']; // no tiers, baseCost=1
    expect(cumulativeCost(ability, 0)).toBe(1);
    expect(cumulativeCost(ability, 3)).toBe(1); // no tiers array, so no additions
  });
});

// ── evaluatePrereq: stat ───────────────────────────────────────────────────────

describe('evaluatePrereq: stat', () => {
  const char = makeChar();

  it('passes when stat equals min exactly (boundary equality: 3.25 >= 3.25)', () => {
    const stats = allStats(2);
    const statsWithBlock = { ...stats, Block: 3.25 };
    const result = evaluatePrereq({ kind: 'stat', stat: 'Block', min: 3.25 }, char, statsWithBlock, null);
    expect(result.met).toBe(true);
  });

  it('fails when stat is just below min (3.24 < 3.25)', () => {
    const stats = allStats(2);
    const statsWithBlock = { ...stats, Block: 3.24 };
    const result = evaluatePrereq({ kind: 'stat', stat: 'Block', min: 3.25 }, char, statsWithBlock, null);
    expect(result.met).toBe(false);
  });

  it('passes when stat exceeds min', () => {
    const stats = allStats(4);
    const result = evaluatePrereq({ kind: 'stat', stat: 'Speed', min: 2.5 }, char, stats, null);
    expect(result.met).toBe(true);
  });

  it('fails when no stats assigned (effectiveStats = null)', () => {
    const result = evaluatePrereq({ kind: 'stat', stat: 'Serve', min: 3 }, char, null, null);
    expect(result.met).toBe(false);
  });
});

// ── evaluatePrereq: statAny ───────────────────────────────────────────────────

describe('evaluatePrereq: statAny', () => {
  const char = makeChar();

  it('passes when best stat meets min', () => {
    const stats = { ...allStats(2), Spike: 4 };
    const result = evaluatePrereq({ kind: 'statAny', min: 4 }, char, stats, null);
    expect(result.met).toBe(true);
  });

  it('fails when no stat meets min', () => {
    const stats = allStats(3.75);
    const result = evaluatePrereq({ kind: 'statAny', min: 4 }, char, stats, null);
    expect(result.met).toBe(false);
  });

  it('fails when effectiveStats is null', () => {
    const result = evaluatePrereq({ kind: 'statAny', min: 4 }, char, null, null);
    expect(result.met).toBe(false);
  });
});

// ── evaluatePrereq: noStatAtLeast ─────────────────────────────────────────────

describe('evaluatePrereq: noStatAtLeast (Quick Learner inverse)', () => {
  const char = makeChar();

  it('passes when all stats are below threshold', () => {
    const stats = allStats(3.5);
    const result = evaluatePrereq({ kind: 'noStatAtLeast', min: 3.75 }, char, stats, null);
    expect(result.met).toBe(true);
  });

  it('fails when any stat meets or exceeds threshold', () => {
    const stats = { ...allStats(2), Spike: 3.75 };
    const result = evaluatePrereq({ kind: 'noStatAtLeast', min: 3.75 }, char, stats, null);
    expect(result.met).toBe(false);
  });

  it('passes (vacuously) when no stats assigned yet', () => {
    const result = evaluatePrereq({ kind: 'noStatAtLeast', min: 3.75 }, char, null, null);
    expect(result.met).toBe(true);
  });
});

// ── evaluatePrereq: derived ───────────────────────────────────────────────────

describe('evaluatePrereq: derived reach', () => {
  const char = makeChar();

  it('passes when standingReach >= min', () => {
    const derived = makeDerived({ standingReachCm: 260 });
    const result = evaluatePrereq(
      { kind: 'derived', metric: 'standingReach', min: 250 },
      char, null, derived,
    );
    expect(result.met).toBe(true);
  });

  it('passes at boundary equality (standingReach 250 >= 250)', () => {
    const derived = makeDerived({ standingReachCm: 250 });
    const result = evaluatePrereq(
      { kind: 'derived', metric: 'standingReach', min: 250 },
      char, null, derived,
    );
    expect(result.met).toBe(true);
  });

  it('fails when standingReach < min', () => {
    const derived = makeDerived({ standingReachCm: 249 });
    const result = evaluatePrereq(
      { kind: 'derived', metric: 'standingReach', min: 250 },
      char, null, derived,
    );
    expect(result.met).toBe(false);
  });

  it('fails when derived is null', () => {
    const result = evaluatePrereq(
      { kind: 'derived', metric: 'spikingReach', min: 300 },
      char, null, null,
    );
    expect(result.met).toBe(false);
  });
});

// ── evaluatePrereq: ability (double-jump minTier) ─────────────────────────────

describe('evaluatePrereq: ability tier (double-jump)', () => {
  it('passes when ability owned at exactly minTier', () => {
    const char = makeChar({
      selectedAbilities: [makeSel('double-jump', 3)],
    });
    const result = evaluatePrereq(
      { kind: 'ability', id: 'double-jump', minTier: 3 },
      char, null, null,
    );
    expect(result.met).toBe(true);
  });

  it('fails when ability owned at tier < minTier', () => {
    const char = makeChar({
      selectedAbilities: [makeSel('double-jump', 2)],
    });
    const result = evaluatePrereq(
      { kind: 'ability', id: 'double-jump', minTier: 3 },
      char, null, null,
    );
    expect(result.met).toBe(false);
  });

  it('fails when ability not purchased at all', () => {
    const char = makeChar();
    const result = evaluatePrereq(
      { kind: 'ability', id: 'double-jump', minTier: 3 },
      char, null, null,
    );
    expect(result.met).toBe(false);
  });

  it('passes for simple ability ownership (no minTier)', () => {
    const char = makeChar({ selectedAbilities: [makeSel('fan', 0)] });
    const result = evaluatePrereq({ kind: 'ability', id: 'fan' }, char, null, null);
    expect(result.met).toBe(true);
  });
});

// ── evaluatePrereq: meta ─────────────────────────────────────────────────────

describe('evaluatePrereq: meta flags', () => {
  it('notFirstYear: fails for schoolYear=1', () => {
    const char = makeChar({ schoolYear: 1 });
    const result = evaluatePrereq({ kind: 'meta', flag: 'notFirstYear' }, char, null, null);
    expect(result.met).toBe(false);
  });

  it('notFirstYear: passes for schoolYear=2', () => {
    const char = makeChar({ schoolYear: 2 });
    const result = evaluatePrereq({ kind: 'meta', flag: 'notFirstYear' }, char, null, null);
    expect(result.met).toBe(true);
  });

  it('notFirstYear: passes for schoolYear=3', () => {
    const char = makeChar({ schoolYear: 3 });
    const result = evaluatePrereq({ kind: 'meta', flag: 'notFirstYear' }, char, null, null);
    expect(result.met).toBe(true);
  });

  it('thirdYear: passes only for schoolYear=3', () => {
    const char3 = makeChar({ schoolYear: 3 });
    const char2 = makeChar({ schoolYear: 2 });
    expect(evaluatePrereq({ kind: 'meta', flag: 'thirdYear' }, char3, null, null).met).toBe(true);
    expect(evaluatePrereq({ kind: 'meta', flag: 'thirdYear' }, char2, null, null).met).toBe(false);
  });

  it('yearlyOnly: fails when no levelUpHistory', () => {
    const char = makeChar({ levelUpHistory: [] });
    const result = evaluatePrereq({ kind: 'meta', flag: 'yearlyOnly' }, char, null, null);
    expect(result.met).toBe(false);
  });

  it('yearlyOnly: passes when levelUpHistory has an entry', () => {
    const char = makeChar({
      levelUpHistory: [{
        fromYear: 1, toYear: 2,
        teamsPlayed: 2, apGained: 7, heightGainCm: 0.5,
      }],
    });
    const result = evaluatePrereq({ kind: 'meta', flag: 'yearlyOnly' }, char, null, null);
    expect(result.met).toBe(true);
  });

  it('creationOnly: always passes', () => {
    const char = makeChar();
    const result = evaluatePrereq({ kind: 'meta', flag: 'creationOnly' }, char, null, null);
    expect(result.met).toBe(true);
  });
});

// ── evaluatePrereq: or ────────────────────────────────────────────────────────

describe('evaluatePrereq: or-node', () => {
  const char = makeChar();

  it('passes when at least one sub-prereq passes (overhand-pass style)', () => {
    const stats = { ...allStats(2), Pass: 3 }; // Pass 3 >= 2.75
    const result = evaluatePrereq(
      {
        kind: 'or',
        any: [
          { kind: 'stat', stat: 'Pass', min: 2.75 },
          { kind: 'stat', stat: 'Set', min: 2.25 },
        ],
      },
      char, stats, null,
    );
    expect(result.met).toBe(true);
  });

  it('passes when second branch passes (Set 2.5 >= 2.25)', () => {
    const stats = { ...allStats(2), Set: 2.5 }; // Pass=2 < 2.75, Set=2.5 >= 2.25
    const result = evaluatePrereq(
      {
        kind: 'or',
        any: [
          { kind: 'stat', stat: 'Pass', min: 2.75 },
          { kind: 'stat', stat: 'Set', min: 2.25 },
        ],
      },
      char, stats, null,
    );
    expect(result.met).toBe(true);
  });

  it('fails when all sub-prereqs fail', () => {
    const stats = allStats(2); // Pass=2 < 2.75, Set=2 < 2.25
    const result = evaluatePrereq(
      {
        kind: 'or',
        any: [
          { kind: 'stat', stat: 'Pass', min: 2.75 },
          { kind: 'stat', stat: 'Set', min: 2.25 },
        ],
      },
      char, stats, null,
    );
    expect(result.met).toBe(false);
  });
});

// ── maxedOut ──────────────────────────────────────────────────────────────────

describe('evaluateAbility: maxedOut', () => {
  it('training (repeatable=true) is never maxed out regardless of purchases', () => {
    const trainingAbility = ABILITY_MAP['training'];
    for (let n = 0; n <= 5; n++) {
      const sels = Array.from({ length: n }, (_, i) =>
        makeSel('training', 0, 'uid-' + i),
      );
      const char = makeChar({
        selectedAbilities: sels,
        apBudget: makeBudget({ remaining: 999, total: 999 }),
      });
      const ev = evaluateAbility(trainingAbility, char, allStats(2), null);
      expect(ev.maxedOut).toBe(false);
    }
  });

  it('fan (no maxTimes, maxTimes defaults to 1) is maxed after 1 purchase', () => {
    const fanAbility = ABILITY_MAP['fan'];
    // Not yet purchased
    const charBefore = makeChar({ apBudget: makeBudget({ remaining: 10, total: 10 }) });
    expect(evaluateAbility(fanAbility, charBefore, null, null).maxedOut).toBe(false);
    // Purchased once
    const charAfter = makeChar({
      selectedAbilities: [makeSel('fan', 0)],
      apBudget: makeBudget({ remaining: 10, total: 10 }),
    });
    expect(evaluateAbility(fanAbility, charAfter, null, null).maxedOut).toBe(true);
  });

  it('quick-learner (maxTimes=5) is not maxed at 4 purchases, maxed at 5', () => {
    const ability = ABILITY_MAP['quick-learner'];
    const statsOk = allStats(3.5); // noStatAtLeast 3.75: all 3.5 => no stat >= 3.75 => passes

    const char4 = makeChar({
      selectedAbilities: Array.from({ length: 4 }, (_, i) => makeSel('quick-learner', 0, 'u' + i)),
      apBudget: makeBudget({ remaining: 999, total: 999 }),
    });
    expect(evaluateAbility(ability, char4, statsOk, null).maxedOut).toBe(false);

    const char5 = makeChar({
      selectedAbilities: Array.from({ length: 5 }, (_, i) => makeSel('quick-learner', 0, 'u' + i)),
      apBudget: makeBudget({ remaining: 999, total: 999 }),
    });
    expect(evaluateAbility(ability, char5, statsOk, null).maxedOut).toBe(true);
  });
});

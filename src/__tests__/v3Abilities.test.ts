// src/__tests__/v3Abilities.test.ts
// Everything the v.3 rules changed or added to the ability set:
// new / re-costed abilities, the six-skill Training chooser, stacking Stamina
// costs, Weight Lifting's Vertical Jump option and Playcalling's tier ladder.
//
// Rule citations are from `Haikyu_ Gauntlet RPG v.3.md` (Abilities WIP table).
import { describe, it, expect } from 'vitest';
import type {
  APBudget,
  Character,
  PhysicalAttributes,
  SelectedAbility,
  SkillStats,
} from '../types';
import { VB_SKILL_STAT_NAMES, heightRollToVerticalModifier } from '../types';
import { ABILITY_MAP } from '../data/abilities';
import { computeEffectiveStats, computeDerived } from '../state/characterStore';
import { STAT_FLOOR } from '../engine/effects';
import { computeSpent } from '../engine/apEngine';
import { cumulativeCost, evaluateAbility } from '../engine/prereqEngine';

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
  // Back-solve raw rolls from the Physical Attributes Table (148 + 2r, 39 + 3r);
  // the fixture keeps the explicit cm values, so the modifier is informational only.
  const heightRoll = Math.round((heightCm - 148) / 2);
  return {
    heightRoll,
    verticalRoll: Math.round((verticalCm - 39) / 3),
    heightCm,
    verticalModifier: heightRollToVerticalModifier(heightRoll),
    verticalCm,
  };
}

function makeSel(
  abilityId: string,
  uid = 'uid-' + abilityId,
  chooserSelections: SelectedAbility['chooserSelections'] = {},
  tier = 0,
): SelectedAbility {
  return { uid, abilityId, tier, chooserSelections };
}

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    name: 'Test', schoolYear: 1,
    physicalPool: { rollA: null, rollB: null },
    physical: null, reaches: null,
    skillPool: { rolls: Array(10).fill(null) },
    skills: allStats(3), yearRoll: null, experience: null,
    apBudget: makeBudget({ total: 60, remaining: 60 }),
    selectedAbilities: [], levelUpHistory: [],
    seed: null, seeded: false,
    ...overrides,
  };
}

// ── Costs ─────────────────────────────────────────────────────────────────────

describe('v.3 ability costs', () => {
  it.each([
    ['training', 6],             // v.3 "Training Cost: 6 AP" (v.2: 5)
    ['quick-learner', 4],        // v.3 "Quick Learner: Cost: 4 AP" (v.2: 3)
    ['boom-jump-technique', 7],  // v.3 "Cost: ~~4~~ 7 AP"
    ['growth-spurt', 9],         // v.3 "Cost: ~~5~~ 9 AP"
    ['rest', 2],                 // new in v.3
    ['weight-lifting', 3],       // new in v.3
    ['game-study', 2],           // new in v.3
    ['flexibility', 4],          // new in v.3
    ['playcalling', 2],          // new in v.3
  ])('%s costs %i AP', (id, cost) => {
    expect(ABILITY_MAP[id].baseCost).toBe(cost);
  });
});

// ── Training / Quick Learner: six-skill chooser + Stamina cost ────────────────

describe('Training and Quick Learner (v.3)', () => {
  it.each(['training', 'quick-learner'])(
    '%s may only raise Serve / Spike / Set / Pass / Dig / Block',
    (id) => {
      const effect = ABILITY_MAP[id].effects![0];
      expect(effect.kind).toBe('statDelta');
      const choose = (effect as { choose?: unknown }).choose;
      expect(choose).toEqual([...VB_SKILL_STAT_NAMES]);
      // The four non-VB stats are no longer valid targets (v.2 allowed "any Stat").
      for (const forbidden of ['Speed', 'Power', 'IQ', 'Stamina']) {
        expect(choose as string[]).not.toContain(forbidden);
      }
    },
  );

  it.each(['training', 'quick-learner'])('%s also costs -0.25 Stamina', (id) => {
    expect(ABILITY_MAP[id].effects![1]).toEqual({
      kind: 'statDelta', stat: 'Stamina', delta: -0.25,
    });
  });

  it('Stamina penalties stack across repeat Training purchases', () => {
    const char = makeChar({
      skills: allStats(2),
      selectedAbilities: [
        makeSel('training', 't1', { 0: 'Spike' }),
        makeSel('training', 't2', { 0: 'Serve' }),
        makeSel('training', 't3', { 0: 'Spike' }),
      ],
    });
    const eff = computeEffectiveStats(char)!;
    expect(eff.Spike).toBeCloseTo(2.5, 10);
    expect(eff.Serve).toBeCloseTo(2.25, 10);
    expect(eff.Stamina).toBeCloseTo(1.25, 10); // 2 − 3 × 0.25
  });

  it('mixed Training + Quick Learner Stamina costs stack too', () => {
    const char = makeChar({
      skills: allStats(2),
      selectedAbilities: [
        makeSel('training', 't1', { 0: 'Dig' }),
        makeSel('quick-learner', 'q1', { 0: 'Dig' }),
      ],
    });
    const eff = computeEffectiveStats(char)!;
    expect(eff.Dig).toBeCloseTo(2.5, 10);
    expect(eff.Stamina).toBeCloseTo(1.5, 10);
  });

  it('three Training purchases cost 18 AP at 6 AP each', () => {
    const char = makeChar({
      selectedAbilities: [
        makeSel('training', 't1'), makeSel('training', 't2'), makeSel('training', 't3'),
      ],
    });
    expect(computeSpent(char)).toBe(18);
  });
});

// ── Rest ──────────────────────────────────────────────────────────────────────

describe('Rest (new in v.3)', () => {
  it('adds +0.25 Stamina and nothing else', () => {
    const char = makeChar({ skills: allStats(2), selectedAbilities: [makeSel('rest')] });
    const eff = computeEffectiveStats(char)!;
    expect(eff.Stamina).toBeCloseTo(2.25, 10);
    expect(eff.Spike).toBe(2);
  });

  it('is uncapped (no "(N)" in the source) and never maxes out', () => {
    const ability = ABILITY_MAP['rest'];
    expect(ability.repeatable).toBe(true);
    expect(ability.maxTimes).toBeUndefined();
    expect(ability.prereqs).toEqual([]);

    const char = makeChar({
      selectedAbilities: Array.from({ length: 6 }, (_, i) => makeSel('rest', 'r' + i)),
    });
    expect(evaluateAbility(ability, char, allStats(3), null).maxedOut).toBe(false);
  });

  it('offsets a Training Stamina cost when bought alongside it', () => {
    const char = makeChar({
      skills: allStats(2),
      selectedAbilities: [makeSel('training', 't1', { 0: 'Set' }), makeSel('rest', 'r1')],
    });
    expect(computeEffectiveStats(char)!.Stamina).toBeCloseTo(2, 10);
  });
});

// ── Weight Lifting ────────────────────────────────────────────────────────────

describe('Stat floor (v.3 Stamina costs)', () => {
  it('floors an effective stat at 1.00 after summing every penalty', () => {
    // Three Weight Lifting purchases = -1.5 Stamina; from 2.0 that would be 0.5.
    const char = makeChar({
      skills: allStats(2),
      selectedAbilities: Array.from({ length: 3 }, (_, i) =>
        makeSel('weight-lifting', 'w' + i, { 0: 'power' })),
    });
    const eff = computeEffectiveStats(char)!;
    expect(eff.Stamina).toBe(STAT_FLOOR);
    expect(eff.Stamina).toBe(1);
    // Bonuses on other stats are untouched and there is no ceiling.
    expect(eff.Power).toBeCloseTo(2.75, 5);
  });

  it('floors the summed total, independent of purchase order', () => {
    // Stamina 1.0 base: Weight Lifting (-0.5) + Rest (+0.25) sums to 0.75 -> floored to 1.0.
    // Two Rests would sum to exactly 1.0; a third lifts it to 1.25.
    const sels = [
      makeSel('weight-lifting', 'w1', { 0: 'speed' }),
      makeSel('rest', 'r1', {}),
    ];
    const base = { ...allStats(3), Stamina: 1 };
    expect(computeEffectiveStats(makeChar({ skills: base, selectedAbilities: sels }))!.Stamina).toBe(1);
    expect(computeEffectiveStats(makeChar({ skills: base, selectedAbilities: [...sels].reverse() }))!.Stamina).toBe(1);
    const threeRests = [...sels, makeSel('rest', 'r2', {}), makeSel('rest', 'r3', {})];
    expect(computeEffectiveStats(makeChar({ skills: base, selectedAbilities: threeRests }))!.Stamina).toBeCloseTo(1.25, 5);
  });

  it('leaves stats above the floor exactly as computed', () => {
    const char = makeChar({
      skills: allStats(3),
      selectedAbilities: [makeSel('game-study', 'g1', {})],
    });
    expect(computeEffectiveStats(char)!.Stamina).toBeCloseTo(2.75, 5);
  });
});

describe('Weight Lifting (new in v.3)', () => {
  const ability = ABILITY_MAP['weight-lifting'];

  it('is capped at 3 purchases with no prereq', () => {
    expect(ability.maxTimes).toBe(3);
    expect(ability.prereqs).toEqual([]);

    const char = makeChar({
      selectedAbilities: Array.from({ length: 3 }, (_, i) =>
        makeSel('weight-lifting', 'w' + i, { 0: 'power' })),
    });
    expect(evaluateAbility(ability, char, allStats(3), null).maxedOut).toBe(true);
  });

  it('offers exactly the three source options', () => {
    const effect = ability.effects![0] as { kind: 'optionChoice'; options: { id: string }[] };
    expect(effect.kind).toBe('optionChoice');
    expect(effect.options.map((o) => o.id)).toEqual(['speed', 'power', 'vertical']);
  });

  it('the Speed option adds +0.25 Speed, and -0.5 Stamina applies regardless', () => {
    const char = makeChar({
      skills: allStats(3),
      selectedAbilities: [makeSel('weight-lifting', 'w1', { 0: 'speed' })],
    });
    const eff = computeEffectiveStats(char)!;
    expect(eff.Speed).toBeCloseTo(3.25, 10);
    expect(eff.Power).toBe(3);
    expect(eff.Stamina).toBeCloseTo(2.5, 10);
  });

  it('the Power option adds +0.25 Power instead', () => {
    const char = makeChar({
      skills: allStats(3),
      selectedAbilities: [makeSel('weight-lifting', 'w1', { 0: 'power' })],
    });
    const eff = computeEffectiveStats(char)!;
    expect(eff.Power).toBeCloseTo(3.25, 10);
    expect(eff.Speed).toBe(3);
  });

  it('an unresolved pick applies no bonus but still costs -0.5 Stamina', () => {
    const char = makeChar({
      skills: allStats(3),
      selectedAbilities: [makeSel('weight-lifting', 'w1', {})],
    });
    const eff = computeEffectiveStats(char)!;
    expect(eff.Speed).toBe(3);
    expect(eff.Power).toBe(3);
    expect(eff.Stamina).toBeCloseTo(2.5, 10);
    // …and the card reports the outstanding choice, exactly like a stat chooser.
    expect(evaluateAbility(ability, char, allStats(3), null).needsChooser).toBe(true);
  });

  it('a resolved pick clears needsChooser', () => {
    const char = makeChar({
      selectedAbilities: [makeSel('weight-lifting', 'w1', { 0: 'vertical' })],
    });
    expect(evaluateAbility(ability, char, allStats(3), null).needsChooser).toBe(false);
  });

  it('three Speed/Power purchases stack their bonuses and their Stamina cost', () => {
    const char = makeChar({
      skills: allStats(3),
      selectedAbilities: [
        makeSel('weight-lifting', 'w1', { 0: 'speed' }),
        makeSel('weight-lifting', 'w2', { 0: 'speed' }),
        makeSel('weight-lifting', 'w3', { 0: 'power' }),
      ],
    });
    const eff = computeEffectiveStats(char)!;
    expect(eff.Speed).toBeCloseTo(3.5, 10);
    expect(eff.Power).toBeCloseTo(3.25, 10);
    expect(eff.Stamina).toBeCloseTo(1.5, 10); // 3 − 3 × 0.5
  });
});

// ── verticalDelta reach maths ─────────────────────────────────────────────────

describe('Weight Lifting +3 cm Vertical Jump (verticalDelta)', () => {
  const physical = makePhysical(180, 75); // standing 234, spiking 309, blocking 297.75

  it('raises effective vertical, spiking reach and blocking reach', () => {
    const char = makeChar({
      physical,
      selectedAbilities: [makeSel('weight-lifting', 'w1', { 0: 'vertical' })],
    });
    const d = computeDerived(char)!;
    expect(d.effectiveVerticalCm).toBe(78);
    expect(d.effectiveHeightCm).toBe(180);
    expect(d.standingReachCm).toBeCloseTo(234, 10);          // unaffected by vertical
    expect(d.spikingReachCm).toBeCloseTo(1.3 * 180 + 78, 10); // 312
    expect(d.blockingReachCm).toBeCloseTo(1.3 * 180 + 0.85 * 78, 10); // 300.3
  });

  it('stacks across purchases and combines with Growth Spurt and Boom Jump', () => {
    const char = makeChar({
      physical,
      selectedAbilities: [
        makeSel('weight-lifting', 'w1', { 0: 'vertical' }),
        makeSel('weight-lifting', 'w2', { 0: 'vertical' }),
        makeSel('growth-spurt', 'g1'),            // +8 cm height
        makeSel('boom-jump-technique', 'b1'),     // +6 cm spiking reach
      ],
    });
    const d = computeDerived(char)!;
    expect(d.effectiveVerticalCm).toBe(81);
    expect(d.effectiveHeightCm).toBe(188);
    expect(d.spikingReachCm).toBeCloseTo(1.3 * 188 + 81 + 6, 10);
    expect(d.blockingReachCm).toBeCloseTo(1.3 * 188 + 0.85 * 81, 10);
  });

  it('a Speed/Power pick leaves the vertical jump alone', () => {
    const char = makeChar({
      physical,
      selectedAbilities: [makeSel('weight-lifting', 'w1', { 0: 'power' })],
    });
    const d = computeDerived(char)!;
    expect(d.effectiveVerticalCm).toBe(75);
    expect(d.spikingReachCm).toBeCloseTo(309, 10);
  });

  it('an unresolved pick leaves the vertical jump alone', () => {
    const char = makeChar({ physical, selectedAbilities: [makeSel('weight-lifting', 'w1', {})] });
    expect(computeDerived(char)!.effectiveVerticalCm).toBe(75);
  });

  it('Swing Block applies its 0.9 coefficient to the boosted vertical', () => {
    const char = makeChar({
      physical,
      selectedAbilities: [
        makeSel('weight-lifting', 'w1', { 0: 'vertical' }),
        makeSel('swing-block', 's1'),
      ],
    });
    const d = computeDerived(char)!;
    expect(d.blockingCoef).toBe(0.9);
    expect(d.blockingReachCm).toBeCloseTo(1.3 * 180 + 0.9 * 78, 10);
  });
});

// ── Game Study ────────────────────────────────────────────────────────────────

describe('Game Study (new in v.3)', () => {
  it('is capped at 3 purchases with no prereq', () => {
    expect(ABILITY_MAP['game-study'].maxTimes).toBe(3);
    expect(ABILITY_MAP['game-study'].prereqs).toEqual([]);
  });

  it('adds +0.25 IQ and -0.25 Stamina, stacking across purchases', () => {
    const char = makeChar({
      skills: allStats(3),
      selectedAbilities: [makeSel('game-study', 'g1'), makeSel('game-study', 'g2')],
    });
    const eff = computeEffectiveStats(char)!;
    expect(eff.IQ).toBeCloseTo(3.5, 10);
    expect(eff.Stamina).toBeCloseTo(2.5, 10);
  });

  it('needs no chooser (both effects are fixed)', () => {
    const char = makeChar({ selectedAbilities: [makeSel('game-study', 'g1')] });
    expect(evaluateAbility(ABILITY_MAP['game-study'], char, allStats(3), null).needsChooser)
      .toBe(false);
  });
});

// ── Flexibility ───────────────────────────────────────────────────────────────

describe('Flexibility (new in v.3)', () => {
  const ability = ABILITY_MAP['flexibility'];

  it('costs 4 AP and requires Stamina 3.25+', () => {
    expect(ability.baseCost).toBe(4);
    expect(ability.prereqs).toEqual([{ kind: 'stat', stat: 'Stamina', min: 3.25 }]);

    const char = makeChar();
    expect(evaluateAbility(ability, char, allStats(3), null).eligible).toBe(false);
    expect(evaluateAbility(ability, char, allStats(3.25), null).eligible).toBe(true);
  });

  it('may be purchased at most twice', () => {
    expect(ability.maxTimes).toBe(2);

    const oneCopy = makeChar({ selectedAbilities: [makeSel('flexibility', 'f1', { 0: 'spin' })] });
    expect(evaluateAbility(ability, oneCopy, allStats(3.5), null).maxedOut).toBe(false);

    const twoCopies = makeChar({
      selectedAbilities: [
        makeSel('flexibility', 'f1', { 0: 'spin' }),
        makeSel('flexibility', 'f2', { 0: 'midair-rotation' }),
      ],
    });
    expect(evaluateAbility(ability, twoCopies, allStats(3.5), null).maxedOut).toBe(true);
  });

  it('records the pick per purchase, and both purchases may pick the same option', () => {
    const sameTwice = makeChar({
      selectedAbilities: [
        makeSel('flexibility', 'f1', { 0: 'spin' }),
        makeSel('flexibility', 'f2', { 0: 'spin' }),
      ],
    });
    expect(sameTwice.selectedAbilities.map((s) => s.chooserSelections[0])).toEqual(['spin', 'spin']);
    expect(evaluateAbility(ability, sameTwice, allStats(3.5), null).needsChooser).toBe(false);
  });

  it('both options are narrative only — no stat or reach effect', () => {
    const effect = ability.effects![0] as {
      kind: 'optionChoice';
      options: { id: string; detail?: string; effects?: unknown[] }[];
    };
    expect(effect.kind).toBe('optionChoice');
    expect(effect.options.map((o) => o.id)).toEqual(['spin', 'midair-rotation']);
    for (const option of effect.options) {
      expect(option.effects).toBeUndefined();
      expect(option.detail).toBeTruthy();
    }

    const char = makeChar({
      skills: allStats(3.5),
      physical: makePhysical(180, 75),
      selectedAbilities: [makeSel('flexibility', 'f1', { 0: 'spin' })],
    });
    expect(computeEffectiveStats(char)).toEqual(allStats(3.5));
    expect(computeDerived(char)!.spikingReachCm).toBeCloseTo(309, 10);
  });

  it('an unmade pick is flagged the same way a stat chooser is', () => {
    const char = makeChar({ selectedAbilities: [makeSel('flexibility', 'f1', {})] });
    expect(evaluateAbility(ability, char, allStats(3.5), null).needsChooser).toBe(true);
  });
});

// ── Playcalling ───────────────────────────────────────────────────────────────

describe('Playcalling (new in v.3)', () => {
  const ability = ABILITY_MAP['playcalling'];

  it('requires IQ 3+ AND Set 3.5+', () => {
    expect(ability.prereqs).toEqual([
      { kind: 'stat', stat: 'IQ', min: 3 },
      { kind: 'stat', stat: 'Set', min: 3.5 },
    ]);

    const char = makeChar();
    expect(evaluateAbility(ability, char, allStats(3), null).eligible).toBe(false);          // Set too low
    expect(evaluateAbility(ability, char, { ...allStats(3), Set: 3.5 }, null).eligible).toBe(true);
    expect(evaluateAbility(ability, char, { ...allStats(3.5), IQ: 2.75 }, null).eligible).toBe(false);
  });

  it('has the three source tiers with their additional costs', () => {
    expect(ability.tiers).toEqual([
      { label: 'Kageyama Plays', addCost: 0 },
      { label: 'Oikawa Plays',   addCost: 2 },
      { label: 'Kenma Plays',    addCost: 3 },
    ]);
  });

  it('cumulative cost per tier is 2 / 4 / 7 AP', () => {
    expect(cumulativeCost(ability, 1)).toBe(2); // base 2 + 0
    expect(cumulativeCost(ability, 2)).toBe(4); // + 2
    expect(cumulativeCost(ability, 3)).toBe(7); // + 3
  });

  it('computeSpent charges the cumulative tier cost', () => {
    const char = makeChar({ selectedAbilities: [makeSel('playcalling', 'p1', {}, 3)] });
    expect(computeSpent(char)).toBe(7);
  });

  it('is a single purchase with no creation-time stat effect', () => {
    expect(ability.maxTimes).toBeUndefined();
    expect(ability.repeatable).toBeUndefined();
    expect(ability.effects).toEqual([]);
  });
});

// ── Stale picks from a v.2 save ───────────────────────────────────────────────

describe('a v.2 save whose Training targeted a non-VB stat', () => {
  // v.2 Training allowed "any Stat", so an old save may hold e.g. { 0: 'Power' }.
  // v.3 no longer offers it: the bonus must not apply, and the purchase must ask
  // the player to choose again.
  const stale = makeChar({
    skills: allStats(2),
    selectedAbilities: [makeSel('training', 't1', { 0: 'Power' })],
  });

  it('does not grant the no-longer-allowed bonus', () => {
    const eff = computeEffectiveStats(stale)!;
    expect(eff.Power).toBe(2);
    expect(eff.Stamina).toBeCloseTo(1.75, 10); // the fixed cost still applies
  });

  it('is reported as still owing a choice', () => {
    expect(evaluateAbility(ABILITY_MAP['training'], stale, allStats(2), null).needsChooser)
      .toBe(true);
  });

  it('a valid VB pick is applied as normal', () => {
    const fixed = makeChar({
      skills: allStats(2),
      selectedAbilities: [makeSel('training', 't1', { 0: 'Block' })],
    });
    expect(computeEffectiveStats(fixed)!.Block).toBeCloseTo(2.25, 10);
    expect(evaluateAbility(ABILITY_MAP['training'], fixed, allStats(2), null).needsChooser)
      .toBe(false);
  });
});

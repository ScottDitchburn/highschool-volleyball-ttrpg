// src/__tests__/dataIntegrity.test.ts
import { describe, it, expect } from 'vitest';
import { ABILITIES, ABILITY_MAP } from '../data/abilities';
import type { Prereq } from '../types';

const KNOWN_PREREQ_KINDS = new Set<string>([
  'stat', 'statAny', 'noStatAtLeast', 'derived', 'ability', 'meta', 'or',
]);

const KNOWN_EFFECT_KINDS = new Set<string>([
  'statDelta', 'heightDelta', 'spikingReachDelta', 'overrideBlockingCoef',
]);

function collectPrereqKinds(prereqs: Prereq[]): string[] {
  const kinds: string[] = [];
  for (const p of prereqs) {
    kinds.push(p.kind);
    if (p.kind === 'or') {
      kinds.push(...collectPrereqKinds(p.any));
    }
  }
  return kinds;
}

describe('data integrity: ABILITIES array', () => {
  it('contains exactly 40 abilities', () => {
    expect(ABILITIES.length).toBe(40);
  });

  it('all ability ids are unique', () => {
    const ids = ABILITIES.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every ability has a non-empty id and name', () => {
    for (const a of ABILITIES) {
      expect(a.id.trim().length).toBeGreaterThan(0);
      expect(a.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('every ability has a numeric baseCost >= 0', () => {
    for (const a of ABILITIES) {
      expect(typeof a.baseCost).toBe('number');
      expect(a.baseCost).toBeGreaterThanOrEqual(0);
    }
  });

  it('every tiered ability has tiers with numeric addCost', () => {
    for (const a of ABILITIES) {
      if (a.tiers) {
        expect(a.tiers.length).toBeGreaterThan(0);
        for (const tier of a.tiers) {
          expect(typeof tier.addCost).toBe('number');
          expect(tier.label.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every prereq kind is one of the known kinds', () => {
    for (const a of ABILITIES) {
      const kinds = collectPrereqKinds(a.prereqs);
      for (const kind of kinds) {
        expect(KNOWN_PREREQ_KINDS.has(kind)).toBe(true);
      }
    }
  });

  it('every effect kind is one of the known kinds', () => {
    for (const a of ABILITIES) {
      if (a.effects) {
        for (const eff of a.effects) {
          expect(KNOWN_EFFECT_KINDS.has(eff.kind)).toBe(true);
        }
      }
    }
  });

  it('ABILITY_MAP covers all abilities (same keys as ABILITIES)', () => {
    const abilityIds = new Set(ABILITIES.map((a) => a.id));
    const mapKeys = new Set(Object.keys(ABILITY_MAP));
    expect(mapKeys.size).toBe(abilityIds.size);
    for (const id of abilityIds) {
      expect(mapKeys.has(id)).toBe(true);
    }
  });

  it('ABILITY_MAP entries point to the same objects as ABILITIES', () => {
    for (const a of ABILITIES) {
      expect(ABILITY_MAP[a.id]).toBe(a);
    }
  });

  it('repeatable abilities have no maxTimes', () => {
    for (const a of ABILITIES) {
      if (a.repeatable) {
        expect(a.maxTimes).toBeUndefined();
      }
    }
  });

  it('known abilities exist by id (spot-check)', () => {
    const required = [
      'training', 'quick-learner', 'jump-serve', 'boom-jump-technique',
      'growth-spurt', 'swing-block', 'setter-dumps', 'double-jump',
      'standing-block', 'aggressive-spiker', 'fan',
    ];
    for (const id of required) {
      expect(ABILITY_MAP[id]).toBeDefined();
    }
  });

  it('setter-dumps has exactly 5 tiers with non-monotonic addCosts as encoded', () => {
    const sd = ABILITY_MAP['setter-dumps'];
    expect(sd.tiers?.length).toBe(5);
    const addCosts = sd.tiers!.map((t) => t.addCost);
    // Tier V (index 4) has addCost=2, which is less than Tier IV (index 3) addCost=4
    expect(addCosts[3]).toBe(4);
    expect(addCosts[4]).toBe(2);
  });

  it('swing-block has overrideBlockingCoef effect with value 0.9', () => {
    const sb = ABILITY_MAP['swing-block'];
    const coefEffect = sb.effects?.find((e) => e.kind === 'overrideBlockingCoef');
    expect(coefEffect).toBeDefined();
    expect((coefEffect as { kind: 'overrideBlockingCoef'; value: number }).value).toBe(0.9);
  });

  it('boom-jump-technique has spikingReachDelta +6', () => {
    const bj = ABILITY_MAP['boom-jump-technique'];
    const delta = bj.effects?.find((e) => e.kind === 'spikingReachDelta');
    expect(delta).toBeDefined();
    expect((delta as { kind: 'spikingReachDelta'; cm: number }).cm).toBe(6);
  });

  it('growth-spurt has heightDelta +8', () => {
    const gs = ABILITY_MAP['growth-spurt'];
    const delta = gs.effects?.find((e) => e.kind === 'heightDelta');
    expect(delta).toBeDefined();
    expect((delta as { kind: 'heightDelta'; cm: number }).cm).toBe(8);
  });
});

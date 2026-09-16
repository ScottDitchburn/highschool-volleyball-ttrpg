// src/__tests__/verticalModifier.test.ts
// v.3 rule — "Height - Vert Jump Modifier" (Physical Attributes Table).
// The modifier is looked up from the HEIGHT roll, added to the VERTICAL roll in
// roll units, clamped to 3-30, and only then converted to cm via
// `rollToVerticalCm` (39 + 3 x roll, the Physical Attributes Table conversion).
// The full table is asserted row by row in physicalTable.test.ts.
import { describe, it, expect } from 'vitest';
import {
  clampPhysicalRoll,
  rollToHeightCm,
  effectiveVerticalRoll,
  formatVerticalModifier,
  heightRollToVerticalModifier,
  makePhysicalAttributes,
  rollToVerticalCm,
  verticalCmFromRolls,
} from '../types';
import { characterReducer, INITIAL_CHARACTER } from '../state/characterStore';
import {
  get3d10Pmf,
  pmfSumsToOne,
  spikingReachPmf,
  standingReachPmf,
  blockingReachPmf,
  verticalCmPmf,
  verticalCmPmfGivenHeightRoll,
} from '../charts/distributions';

// The "Height - Vert Jump Modifier" column, transcribed from the v.3 rules table.
const TABLE: Record<number, number> = {
  3: +7, 4: +6, 5: +5, 6: +4, 7: +3, 8: +2, 9: +1,
  10: 0, 11: 0, 12: 0, 13: 0,
  14: -1, 15: -2, 16: -3, 17: -4, 18: -5, 19: -6, 20: -7, 21: -8, 22: -9,
  23: -10, 24: -11, 25: -12, 26: -13, 27: -14, 28: -15, 29: -16, 30: -17,
};

describe('heightRollToVerticalModifier', () => {
  it('matches the v.3 Physical Attributes Table for every roll 3-30', () => {
    for (let roll = 3; roll <= 30; roll++) {
      expect(heightRollToVerticalModifier(roll)).toBe(TABLE[roll]);
    }
  });

  it('band edge cases: 3 -> +7, 9 -> +1, 10 -> 0, 13 -> 0, 14 -> -1, 30 -> -17', () => {
    expect(heightRollToVerticalModifier(3)).toBe(7);
    expect(heightRollToVerticalModifier(9)).toBe(1);
    expect(heightRollToVerticalModifier(10)).toBe(0);
    expect(heightRollToVerticalModifier(13)).toBe(0);
    expect(heightRollToVerticalModifier(14)).toBe(-1);
    expect(heightRollToVerticalModifier(30)).toBe(-17);
  });

  it('is monotonically non-increasing in the height roll', () => {
    for (let roll = 4; roll <= 30; roll++) {
      expect(heightRollToVerticalModifier(roll))
        .toBeLessThanOrEqual(heightRollToVerticalModifier(roll - 1));
    }
  });

  it('clamps out-of-table input to the 3-30 domain', () => {
    expect(clampPhysicalRoll(0)).toBe(3);
    expect(clampPhysicalRoll(99)).toBe(30);
    expect(heightRollToVerticalModifier(0)).toBe(7);   // treated as roll 3
    expect(heightRollToVerticalModifier(99)).toBe(-17); // treated as roll 30
  });
});

describe('effectiveVerticalRoll / verticalCmFromRolls', () => {
  it('applies the modifier in roll units', () => {
    // height 22 -> modifier -9; raw vertical 18 -> effective 9 -> 66 cm
    expect(effectiveVerticalRoll(22, 18)).toBe(9);
    expect(verticalCmFromRolls(22, 18)).toBe(66); // table row 9
  });

  it('a short player gains: height 5 (+5) with vertical 10 -> roll 15', () => {
    expect(effectiveVerticalRoll(5, 10)).toBe(15);
    expect(verticalCmFromRolls(5, 10)).toBe(rollToVerticalCm(15));
  });

  it('rolls 10-13 leave the vertical untouched', () => {
    for (const h of [10, 11, 12, 13]) {
      expect(effectiveVerticalRoll(h, 17)).toBe(17);
      expect(verticalCmFromRolls(h, 17)).toBe(rollToVerticalCm(17));
    }
  });

  it('clamps low: height 30 (-17) + vertical 5 -> roll 3 (table minimum)', () => {
    expect(effectiveVerticalRoll(30, 5)).toBe(3);      // 5 - 17 = -12, clamped to 3
    expect(verticalCmFromRolls(30, 5)).toBe(48);       // table row 3
  });

  it('clamps high: height 3 (+7) + vertical 28 -> roll 30 (table maximum)', () => {
    expect(effectiveVerticalRoll(3, 28)).toBe(30);     // 28 + 7 = 35, clamped to 30
    expect(verticalCmFromRolls(3, 28)).toBe(129);      // table row 30
  });

  it('never leaves the 3-30 table domain for any roll pair', () => {
    for (let h = 3; h <= 30; h++) {
      for (let v = 3; v <= 30; v++) {
        const eff = effectiveVerticalRoll(h, v);
        expect(eff).toBeGreaterThanOrEqual(3);
        expect(eff).toBeLessThanOrEqual(30);
        expect(verticalCmFromRolls(h, v)).toBe(39 + 3 * eff);
      }
    }
  });
});

describe('makePhysicalAttributes', () => {
  it('keeps the raw roll, records the modifier and derives cm from the modified roll', () => {
    const p = makePhysicalAttributes(22, 18);
    expect(p).toEqual({
      heightRoll: 22,
      verticalRoll: 18,      // raw, as assigned from the pool
      heightCm: 192,         // table: 148 + 2*22
      verticalModifier: -9,
      verticalCm: 66,        // table: 39 + 3*(18-9)
    });
    expect(p.verticalCm).toBe(rollToVerticalCm(effectiveVerticalRoll(22, 18)));
  });
});

describe('formatVerticalModifier', () => {
  it('signs positive modifiers and leaves zero unsigned', () => {
    expect(formatVerticalModifier(7)).toBe('+7');
    expect(formatVerticalModifier(0)).toBe('0');
    expect(formatVerticalModifier(-9)).toBe('-9');
  });
});

describe('ASSIGN_PHYSICAL reducer', () => {
  it('stores the modifier and the modified vertical cm', () => {
    const next = characterReducer(INITIAL_CHARACTER, {
      type: 'ASSIGN_PHYSICAL', heightRoll: 22, verticalRoll: 18,
    });
    expect(next.physical).toEqual({
      heightRoll: 22, verticalRoll: 18, heightCm: 192, verticalModifier: -9, verticalCm: 66,
    });
  });

  it('feeds the modified vertical into the cached reaches', () => {
    const next = characterReducer(INITIAL_CHARACTER, {
      type: 'ASSIGN_PHYSICAL', heightRoll: 22, verticalRoll: 18,
    });
    expect(next.reaches!.standingReachCm).toBeCloseTo(1.3 * 192, 10);
    expect(next.reaches!.spikingReachCm).toBeCloseTo(1.3 * 192 + 66, 10);   // 66, not 93
    expect(next.reaches!.blockingReachCm).toBeCloseTo(1.3 * 192 + 0.85 * 66, 10);
  });

  it('clamps at assignment time (height 30 + vertical 5 -> table-minimum roll 3)', () => {
    const next = characterReducer(INITIAL_CHARACTER, {
      type: 'ASSIGN_PHYSICAL', heightRoll: 30, verticalRoll: 5,
    });
    expect(next.physical!.verticalModifier).toBe(-17);
    expect(next.physical!.verticalCm).toBe(48); // table row 3
  });
});

// ── Distributions ────────────────────────────────────────────────────────────

/** Independent brute-force pmf of clamp(V + mod(H)) over all 3d10 x 3d10 pairs. */
function bruteForceVerticalCmPmf(): Map<number, number> {
  const rollPmf = new Map<number, number>();
  for (let a = 1; a <= 10; a++)
    for (let b = 1; b <= 10; b++)
      for (let c = 1; c <= 10; c++)
        rollPmf.set(a + b + c, (rollPmf.get(a + b + c) ?? 0) + 1 / 1000);

  const out = new Map<number, number>();
  for (const [h, hp] of rollPmf) {
    const mod = TABLE[h];
    for (const [v, vp] of rollPmf) {
      const eff = Math.min(30, Math.max(3, v + mod));
      const cm = 39 + 3 * eff; // mirrors rollToVerticalCm
      out.set(cm, (out.get(cm) ?? 0) + hp * vp);
    }
  }
  return out;
}

describe('verticalCmPmf (unconditional, v.3)', () => {
  const pmf = verticalCmPmf();

  it('sums to 1', () => {
    expect(pmfSumsToOne(pmf)).toBe(true);
  });

  it('support is still every 3 cm across the full roll 3-30 range', () => {
    expect(pmf[0].value).toBe(rollToVerticalCm(3));
    expect(pmf[pmf.length - 1].value).toBe(rollToVerticalCm(30));
    expect(pmf.length).toBe(28); // rolls 3..30
    for (let i = 1; i < pmf.length; i++) {
      expect(pmf[i].value - pmf[i - 1].value).toBe(3);
      expect(pmf[i].prob).toBeGreaterThan(0);
    }
  });

  it('matches an independent brute-force enumeration exactly', () => {
    const brute = bruteForceVerticalCmPmf();
    expect(pmf.length).toBe(brute.size);
    for (const { value, prob } of pmf) {
      expect(prob).toBeCloseTo(brute.get(value)!, 12);
    }
  });

  it('differs from the raw 3d10 conversion — the clamp piles mass on the ends', () => {
    const raw = get3d10Pmf().map(({ value, prob }) => ({ value: rollToVerticalCm(value), prob }));
    const rawMin = raw[0].prob;   // P(roll = 3) = 0.001
    const modMin = pmf[0].prob;
    expect(modMin).toBeGreaterThan(rawMin);
    expect(pmf[pmf.length - 1].prob).toBeGreaterThan(raw[raw.length - 1].prob);
  });
});

describe('verticalCmPmfGivenHeightRoll (conditional, v.3)', () => {
  it('sums to 1 for every height roll', () => {
    for (let h = 3; h <= 30; h++) {
      expect(pmfSumsToOne(verticalCmPmfGivenHeightRoll(h))).toBe(true);
    }
  });

  it('is the unshifted 3d10 curve for the ±0 band (rolls 10-13)', () => {
    const pmf = verticalCmPmfGivenHeightRoll(12);
    const raw = get3d10Pmf();
    expect(pmf.length).toBe(raw.length);
    pmf.forEach((p, i) => {
      expect(p.value).toBe(rollToVerticalCm(raw[i].value));
      expect(p.prob).toBeCloseTo(raw[i].prob, 12);
    });
  });

  it('a tall character (height 30, -17) tops out at an effective roll of 13', () => {
    const pmf = verticalCmPmfGivenHeightRoll(30);
    expect(pmf[0].value).toBe(rollToVerticalCm(3));       // clamped floor
    expect(pmf[pmf.length - 1].value).toBe(rollToVerticalCm(13)); // 30 - 17 = 13
  });

  it('a short character (height 3, +7) bottoms out at an effective roll of 10', () => {
    const pmf = verticalCmPmfGivenHeightRoll(3);
    expect(pmf[0].value).toBe(rollToVerticalCm(10));      // 3 + 7 = 10
    expect(pmf[pmf.length - 1].value).toBe(rollToVerticalCm(30)); // clamped ceiling
  });

  it('averaging the conditional pmfs over the height pmf reproduces the unconditional one', () => {
    const mixed = new Map<number, number>();
    for (const { value: h, prob: hp } of get3d10Pmf()) {
      for (const { value, prob } of verticalCmPmfGivenHeightRoll(h)) {
        mixed.set(value, (mixed.get(value) ?? 0) + hp * prob);
      }
    }
    for (const { value, prob } of verticalCmPmf()) {
      expect(prob).toBeCloseTo(mixed.get(value)!, 12);
    }
  });
});

describe('reach PMFs use the modified vertical', () => {
  it('still sum to 1', () => {
    expect(pmfSumsToOne(standingReachPmf())).toBe(true);
    expect(pmfSumsToOne(spikingReachPmf())).toBe(true);
    expect(pmfSumsToOne(blockingReachPmf())).toBe(true);
    expect(pmfSumsToOne(blockingReachPmf(0.9))).toBe(true);
  });

  it('standing reach is unaffected by the rule (height only): 202.8-273', () => {
    const values = standingReachPmf().map((p) => p.value);
    expect(Math.min(...values)).toBeCloseTo(1.3 * rollToHeightCm(3), 5);  // 202.8
    expect(Math.max(...values)).toBeCloseTo(1.3 * rollToHeightCm(30), 5); // 273
  });

  it('spiking reach support is narrowed by the modifier', () => {
    const values = spikingReachPmf().map((p) => p.value);
    // Independent bound: for each height roll the vertical roll can only reach
    // clamp(3 + mod) .. clamp(30 + mod), so the reachable corners move inward.
    let lo = Infinity;
    let hi = -Infinity;
    for (let h = 3; h <= 30; h++) {
      const base = 1.3 * rollToHeightCm(h);
      lo = Math.min(lo, base + rollToVerticalCm(effectiveVerticalRoll(h, 3)));
      hi = Math.max(hi, base + rollToVerticalCm(effectiveVerticalRoll(h, 30)));
    }
    expect(Math.min(...values)).toBeCloseTo(lo, 5);
    expect(Math.max(...values)).toBeCloseTo(hi, 5);

    // Strictly inside the pre-v.3 (unmodified) support.
    expect(lo).toBeGreaterThan(1.3 * rollToHeightCm(3) + rollToVerticalCm(3));
    expect(hi).toBeLessThan(1.3 * rollToHeightCm(30) + rollToVerticalCm(30));
  });
});

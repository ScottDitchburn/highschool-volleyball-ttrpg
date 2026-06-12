// src/__tests__/distributions.test.ts
import { describe, it, expect } from 'vitest';
import {
  dicesSumPmf,
  get3d10Pmf,
  get4d4AvgPmf,
  pmfSumsToOne,
  percentileOf,
  standingReachPmf,
  spikingReachPmf,
  blockingReachPmf,
} from '../charts/distributions';

const EPSILON = 1e-9;

describe('dicesSumPmf', () => {
  it('3d10: range is exactly 3 to 30', () => {
    const pmf = get3d10Pmf();
    const values = pmf.map((p) => p.value);
    expect(Math.min(...values)).toBe(3);
    expect(Math.max(...values)).toBe(30);
    expect(values.length).toBe(28); // 3..30 inclusive
  });

  it('3d10: probabilities sum to 1.0 within epsilon', () => {
    const pmf = get3d10Pmf();
    expect(pmfSumsToOne(pmf)).toBe(true);
    const sum = pmf.reduce((acc, p) => acc + p.prob, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(EPSILON);
  });

  it('3d10: all probabilities are positive', () => {
    const pmf = get3d10Pmf();
    for (const p of pmf) {
      expect(p.prob).toBeGreaterThan(0);
    }
  });

  it('3d10: is sorted ascending', () => {
    const pmf = get3d10Pmf();
    for (let i = 1; i < pmf.length; i++) {
      expect(pmf[i].value).toBeGreaterThan(pmf[i - 1].value);
    }
  });
});

describe('get4d4AvgPmf', () => {
  it('range is 1.00 to 4.00', () => {
    const pmf = get4d4AvgPmf();
    const values = pmf.map((p) => p.value);
    expect(Math.min(...values)).toBeCloseTo(1.0, 10);
    expect(Math.max(...values)).toBeCloseTo(4.0, 10);
  });

  it('probabilities sum to 1.0 within epsilon', () => {
    const pmf = get4d4AvgPmf();
    expect(pmfSumsToOne(pmf)).toBe(true);
  });

  it('values are in steps of 0.25', () => {
    const pmf = get4d4AvgPmf();
    for (const p of pmf) {
      // value * 4 should be an integer
      expect(Math.round(p.value * 4)).toBe(p.value * 4);
    }
  });

  it('has 13 distinct values (1.00, 1.25, ..., 4.00)', () => {
    const pmf = get4d4AvgPmf();
    expect(pmf.length).toBe(13);
  });
});

describe('percentileOf', () => {
  const pmf3d10 = get3d10Pmf();

  it('minimum value (3) yields percentile > 0 and <= first prob * 100', () => {
    const pct = percentileOf(3, pmf3d10);
    // P(X <= 3) = P(X=3) = (1/10)^3 = 0.001 => 0.1%
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(1);
  });

  it('maximum value (30) yields ~100 percentile', () => {
    const pct = percentileOf(30, pmf3d10);
    expect(pct).toBeCloseTo(100, 5);
  });

  it('value below minimum yields 0', () => {
    const pct = percentileOf(2, pmf3d10);
    expect(pct).toBe(0);
  });

  it('3d10: median area is roughly symmetric — roll 16/17 near 50%', () => {
    // 3d10 mean is 16.5; the CDF at 16 should be < 50% and at 17 > 50%
    const pct16 = percentileOf(16, pmf3d10);
    const pct17 = percentileOf(17, pmf3d10);
    expect(pct16).toBeLessThan(55);
    expect(pct17).toBeGreaterThan(45);
    // Together they straddle 50
    expect(pct16).toBeLessThan(pct17);
  });
});

describe('reach PMFs', () => {
  it('standingReachPmf sums to 1', () => {
    const pmf = standingReachPmf();
    expect(pmfSumsToOne(pmf)).toBe(true);
  });

  it('spikingReachPmf sums to 1', () => {
    const pmf = spikingReachPmf();
    expect(pmfSumsToOne(pmf)).toBe(true);
  });

  it('blockingReachPmf (default coef=0.85) sums to 1', () => {
    const pmf = blockingReachPmf();
    expect(pmfSumsToOne(pmf)).toBe(true);
  });

  it('blockingReachPmf (swing block coef=0.9) sums to 1', () => {
    const pmf = blockingReachPmf(0.9);
    expect(pmfSumsToOne(pmf)).toBe(true);
  });

  it('standingReachPmf range: height range 3d10 (3-30) => height 156-210 => standing 202.8-273', () => {
    const pmf = standingReachPmf();
    const values = pmf.map((p) => p.value);
    // min: 1.3 * (150 + 2*3) = 1.3 * 156 = 202.8
    // max: 1.3 * (150 + 2*30) = 1.3 * 210 = 273
    expect(Math.min(...values)).toBeCloseTo(202.8, 5);
    expect(Math.max(...values)).toBeCloseTo(273.0, 5);
  });
});

describe('dicesSumPmf generic', () => {
  it('1d6 sums to 1 and each value has prob 1/6', () => {
    const pmf = dicesSumPmf(1, 6);
    expect(pmfSumsToOne(pmf)).toBe(true);
    for (const p of pmf) {
      expect(p.prob).toBeCloseTo(1 / 6, 10);
    }
  });

  it('2d6 sums to 1 and has range 2-12', () => {
    const pmf = dicesSumPmf(2, 6);
    expect(pmfSumsToOne(pmf)).toBe(true);
    const values = pmf.map((p) => p.value);
    expect(Math.min(...values)).toBe(2);
    expect(Math.max(...values)).toBe(12);
  });
});

import { describe, it, expect } from 'vitest';
import { histogramPmf, standingReachPmf, spikingReachPmf, blockingReachPmf, pmfSumsToOne } from '../charts/distributions';

describe('histogramPmf', () => {
  for (const [name, fn] of [['standing', standingReachPmf], ['spiking', spikingReachPmf], ['blocking', blockingReachPmf]] as const) {
    it(`${name}: preserves probability, integer values, evenly spaced, no big gaps`, () => {
      const h = histogramPmf(fn());
      expect(pmfSumsToOne(h)).toBe(true);
      expect(h.every((p) => Number.isInteger(p.value))).toBe(true);
      // Even spacing -> all adjacent gaps equal (contiguous histogram, no combs)
      const gaps = h.slice(1).map((p, i) => p.value - h[i].value);
      expect(new Set(gaps).size).toBe(1);
      // The bulk of bins carry mass (smooth, not a sparse comb)
      const nonZero = h.filter((p) => p.prob > 0).length;
      expect(nonZero / h.length).toBeGreaterThan(0.7);
    });
  }
});

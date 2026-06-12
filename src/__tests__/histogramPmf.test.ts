import { describe, it, expect } from 'vitest';
import { smoothReachDensity, standingReachPmf, spikingReachPmf, blockingReachPmf, pmfSumsToOne } from '../charts/distributions';

describe('smoothReachDensity', () => {
  for (const [name, fn] of [['standing', standingReachPmf], ['spiking', spikingReachPmf], ['blocking', blockingReachPmf]] as const) {
    it(`${name}: sums to 1, integer values, even spacing, and no aliasing spikes`, () => {
      const d = smoothReachDensity(fn());
      expect(pmfSumsToOne(d)).toBe(true);
      expect(d.every((p) => Number.isInteger(p.value))).toBe(true);
      const gaps = d.slice(1).map((p, i) => p.value - d[i].value);
      expect(new Set(gaps).size).toBe(1); // evenly spaced grid
      // Smoothness: no interior bar exceeds 1.6x the average of its two neighbours
      // (the old histogram aliasing spikes were ~2-3x their neighbours).
      const maxNeighbourRatio = Math.max(
        ...d.slice(1, -1).map((p, i) => {
          const avg = (d[i].prob + d[i + 2].prob) / 2;
          return avg > 1e-6 ? p.prob / avg : 1;
        })
      );
      expect(maxNeighbourRatio).toBeLessThan(1.6);
    });
  }
});

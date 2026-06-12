import { describe, it, expect } from 'vitest';
import { binPmfToIntegers, spikingReachPmf, pmfSumsToOne } from '../charts/distributions';

describe('binPmfToIntegers', () => {
  it('preserves total probability and yields integer values', () => {
    const raw = spikingReachPmf();
    const binned = binPmfToIntegers(raw);
    expect(pmfSumsToOne(binned)).toBe(true);
    expect(binned.every((p) => Number.isInteger(p.value))).toBe(true);
    // Binning should merge the many fine-grained spiking values into fewer buckets
    expect(binned.length).toBeLessThan(raw.length);
    // Sorted ascending
    for (let i = 1; i < binned.length; i++) expect(binned[i].value).toBeGreaterThan(binned[i - 1].value);
  });
  it('merges values that round to the same integer', () => {
    const merged = binPmfToIntegers([
      { value: 200.2, prob: 0.1 }, { value: 200.4, prob: 0.2 }, { value: 203.0, prob: 0.7 },
    ]);
    expect(merged).toEqual([{ value: 200, prob: 0.30000000000000004 }, { value: 203, prob: 0.7 }]);
  });
});

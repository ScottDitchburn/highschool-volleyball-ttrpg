import { describe, it, expect } from 'vitest';
import {
  seededPhysicalRoll, seededSkillChip, seededYear, seededYearBonus,
  seededExperienceRoll, seededLevelUpHeight, seededDiceFaces, generateRandomSeed,
} from '../rng/seeded';

describe('seeded RNG determinism', () => {
  it('same seed + slot yields identical dice every time', () => {
    expect(seededDiceFaces('abc', 'physical-0', 3, 10)).toEqual(seededDiceFaces('abc', 'physical-0', 3, 10));
    expect(seededPhysicalRoll('karasuno', 0)).toEqual(seededPhysicalRoll('karasuno', 0));
    expect(seededSkillChip('karasuno', 5)).toEqual(seededSkillChip('karasuno', 5));
  });
  it('different slots / seeds generally differ', () => {
    expect(seededPhysicalRoll('s', 0)).not.toEqual(seededPhysicalRoll('s', 1));
    expect(seededYear('seedA')).toBeTypeOf('number');
    // Two different seeds should not produce identical full skill blocks
    const a = Array.from({ length: 10 }, (_, i) => seededSkillChip('seedA', i).value).join(',');
    const b = Array.from({ length: 10 }, (_, i) => seededSkillChip('seedB', i).value).join(',');
    expect(a).not.toEqual(b);
  });
  it('respects ranges', () => {
    for (const seed of ['a', 'b', 'c', 'longer-seed-123', '🎲emoji']) {
      const p = seededPhysicalRoll(seed, 0);
      expect(p.total).toBeGreaterThanOrEqual(3);
      expect(p.total).toBeLessThanOrEqual(30);
      p.dice.forEach((d) => { expect(d).toBeGreaterThanOrEqual(1); expect(d).toBeLessThanOrEqual(10); });
      const s = seededSkillChip(seed, 0);
      expect(s.value).toBeGreaterThanOrEqual(1);
      expect(s.value).toBeLessThanOrEqual(4);
      expect(Math.round(s.value * 4)).toBeCloseTo(s.value * 4, 5); // multiple of 0.25
      expect(seededYear(seed)).toBeGreaterThanOrEqual(1);
      expect(seededYear(seed)).toBeLessThanOrEqual(3);
      const ex = seededExperienceRoll(seed);
      expect(ex.roll).toBeGreaterThanOrEqual(2);
      expect(ex.roll).toBeLessThanOrEqual(16);
      const lu = seededLevelUpHeight(seed, 2);
      expect(lu.die).toBeGreaterThanOrEqual(1);
      expect(lu.die).toBeLessThanOrEqual(20);
    }
  });
  it('year bonus matches the rules', () => {
    expect(seededYearBonus('x', 1)).toEqual({ dice: [], bonus: 0 });
    const y2 = seededYearBonus('x', 2);
    expect(y2.dice.length).toBe(2);
    expect(y2.bonus).toBe(3 + y2.dice.reduce((a, b) => a + b, 0));
    const y3 = seededYearBonus('x', 3);
    expect(y3.dice.length).toBe(4);
    expect(y3.bonus).toBe(6 + y3.dice.reduce((a, b) => a + b, 0));
  });
  it('generateRandomSeed yields a non-empty token', () => {
    const a = generateRandomSeed();
    expect(a).toMatch(/^[0-9a-z]{4}-[0-9a-z]{4}$/);
  });
});

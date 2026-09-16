// src/__tests__/physicalTable.test.ts
// The Physical Attributes Table is the source of truth for the roll -> cm
// conversions. Every one of its 28 rows is asserted here, transcribed verbatim
// from `Haikyu_ Gauntlet RPG v.3.md`:
//
//   Height(cm)   = 148 + 2 x roll   (roll 3 -> 154, roll 20 -> 188, roll 30 -> 208)
//   Vertical(cm) = 39 + 3 x roll    (roll 3 ->  48, roll 20 ->  99, roll 30 -> 129)
import { describe, it, expect } from 'vitest';
import {
  MAX_PHYSICAL_ROLL,
  MIN_PHYSICAL_ROLL,
  heightRollToVerticalModifier,
  rollToHeightCm,
  rollToVerticalCm,
} from '../types';

/** [roll, height cm, height->vert modifier, vertical jump cm] — verbatim table rows. */
const PHYSICAL_ATTRIBUTES_TABLE: [number, number, number, number][] = [
  [3, 154, +7, 48],
  [4, 156, +6, 51],
  [5, 158, +5, 54],
  [6, 160, +4, 57],
  [7, 162, +3, 60],
  [8, 164, +2, 63],
  [9, 166, +1, 66],
  [10, 168, 0, 69],
  [11, 170, 0, 72],
  [12, 172, 0, 75],
  [13, 174, 0, 78],
  [14, 176, -1, 81],
  [15, 178, -2, 84],
  [16, 180, -3, 87],
  [17, 182, -4, 90],
  [18, 184, -5, 93],
  [19, 186, -6, 96],
  [20, 188, -7, 99],
  [21, 190, -8, 102],
  [22, 192, -9, 105],
  [23, 194, -10, 108],
  [24, 196, -11, 111],
  [25, 198, -12, 114],
  [26, 200, -13, 117],
  [27, 202, -14, 120],
  [28, 204, -15, 123],
  [29, 206, -16, 126],
  [30, 208, -17, 129],
];

describe('Physical Attributes Table', () => {
  it('covers exactly the 28 rolls 3-30', () => {
    expect(PHYSICAL_ATTRIBUTES_TABLE).toHaveLength(28);
    expect(PHYSICAL_ATTRIBUTES_TABLE[0][0]).toBe(MIN_PHYSICAL_ROLL);
    expect(PHYSICAL_ATTRIBUTES_TABLE[27][0]).toBe(MAX_PHYSICAL_ROLL);
    PHYSICAL_ATTRIBUTES_TABLE.forEach(([roll], i) => expect(roll).toBe(i + 3));
  });

  it.each(PHYSICAL_ATTRIBUTES_TABLE)(
    'roll %i -> %i cm height / modifier %i / %i cm vertical',
    (roll, heightCm, modifier, verticalCm) => {
      expect(rollToHeightCm(roll)).toBe(heightCm);
      expect(heightRollToVerticalModifier(roll)).toBe(modifier);
      expect(rollToVerticalCm(roll)).toBe(verticalCm);
    },
  );

  it('every height row matches 148 + 2 x roll', () => {
    for (const [roll, heightCm] of PHYSICAL_ATTRIBUTES_TABLE) {
      expect(heightCm).toBe(148 + 2 * roll);
      expect(rollToHeightCm(roll)).toBe(heightCm);
    }
  });

  it('every vertical row matches 39 + 3 x roll', () => {
    for (const [roll, , , verticalCm] of PHYSICAL_ATTRIBUTES_TABLE) {
      expect(verticalCm).toBe(39 + 3 * roll);
      expect(rollToVerticalCm(roll)).toBe(verticalCm);
    }
  });

  it('endpoints and midpoint called out in the rules', () => {
    expect([rollToHeightCm(3), rollToVerticalCm(3)]).toEqual([154, 48]);
    expect([rollToHeightCm(20), rollToVerticalCm(20)]).toEqual([188, 99]);
    expect([rollToHeightCm(30), rollToVerticalCm(30)]).toEqual([208, 129]);
  });

  it('both columns are strictly increasing in the roll', () => {
    for (let roll = MIN_PHYSICAL_ROLL + 1; roll <= MAX_PHYSICAL_ROLL; roll++) {
      expect(rollToHeightCm(roll)).toBeGreaterThan(rollToHeightCm(roll - 1));
      expect(rollToVerticalCm(roll)).toBeGreaterThan(rollToVerticalCm(roll - 1));
    }
  });
});

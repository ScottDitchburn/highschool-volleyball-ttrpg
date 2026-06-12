// ─────────────────────────────────────────────────────────────────────────────
// Seeded RNG — deterministic, order-independent roll derivation for "Seeded Run".
//
// Every roll SLOT (physical-0, skill-3, year, experience, levelup-height-y2, …)
// derives its dice from hash(seed + slotKey). Because each slot has its own
// independent PRNG stream, outcomes do not depend on the order the user does
// things in: the same seed always yields the same character rolls.
// ─────────────────────────────────────────────────────────────────────────────

/** xmur3 string-hash → seed generator (returns a 32-bit unsigned int each call). */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 PRNG → float in [0,1). */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A PRNG bound to one (seed, slotKey) pair. */
function slotRandom(seed: string, slotKey: string): () => number {
  const seedFn = xmur3(`${seed}::${slotKey}`);
  return mulberry32(seedFn());
}

/** Roll `n` dice of `sides` faces deterministically for a given slot. */
export function seededDiceFaces(seed: string, slotKey: string, n: number, sides: number): number[] {
  const rand = slotRandom(seed, slotKey);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(1 + Math.floor(rand() * sides));
  return out;
}

// ── High-level builders (mirror the live game roll functions) ─────────────────

export interface SeededPhysical { dice: [number, number, number]; total: number; }

/** 3d10 for a physical pool slot (slotIndex 0 or 1). */
export function seededPhysicalRoll(seed: string, slotIndex: number): SeededPhysical {
  const d = seededDiceFaces(seed, `physical-${slotIndex}`, 3, 10) as [number, number, number];
  return { dice: d, total: d[0] + d[1] + d[2] };
}

export interface SeededSkill { dice: [number, number, number, number]; value: number; }

/** 4d4 averaged (1.00–4.00, step 0.25) for skill chip `index` (0–9). */
export function seededSkillChip(seed: string, index: number): SeededSkill {
  const d = seededDiceFaces(seed, `skill-${index}`, 4, 4) as [number, number, number, number];
  const value = Math.round(((d[0] + d[1] + d[2] + d[3]) / 4) * 100) / 100;
  return { dice: d, value };
}

/** 1d3 school year (1, 2, or 3). */
export function seededYear(seed: string): 1 | 2 | 3 {
  return seededDiceFaces(seed, 'year', 1, 3)[0] as 1 | 2 | 3;
}

export interface SeededYearBonus { dice: number[]; bonus: number; }

/** Year bonus AP: 1st=0, 2nd=3+2d4, 3rd=6+4d4. Returns the full bonus value. */
export function seededYearBonus(seed: string, year: 1 | 2 | 3): SeededYearBonus {
  if (year === 2) {
    const dice = seededDiceFaces(seed, 'year-bonus', 2, 4);
    return { dice, bonus: 3 + dice.reduce((a, b) => a + b, 0) };
  }
  if (year === 3) {
    const dice = seededDiceFaces(seed, 'year-bonus', 4, 4);
    return { dice, bonus: 6 + dice.reduce((a, b) => a + b, 0) };
  }
  return { dice: [], bonus: 0 };
}

export interface SeededExperience { dice: [number, number]; roll: number; }

/** 2d8 experience roll total (2–16). */
export function seededExperienceRoll(seed: string): SeededExperience {
  const d = seededDiceFaces(seed, 'experience', 2, 8) as [number, number];
  return { dice: d, roll: d[0] + d[1] };
}

export interface SeededLevelUpHeight { die: number; cm: number; }

/** 1d20 × 0.1 cm off-season height growth, keyed by the year being entered. */
export function seededLevelUpHeight(seed: string, toYear: number): SeededLevelUpHeight {
  const die = seededDiceFaces(seed, `levelup-height-y${toYear}`, 1, 20)[0];
  return { die, cm: Math.round(die * 0.1 * 100) / 100 };
}

/** Generate a fresh, readable, shareable random seed (e.g. "k3f9-x7q2"). */
export function generateRandomSeed(): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  const part = (n: number) => n.toString(36).padStart(7, '0').slice(-4);
  return `${part(bytes[0])}-${part(bytes[1])}`;
}

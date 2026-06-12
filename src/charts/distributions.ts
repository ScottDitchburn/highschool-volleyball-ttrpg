// ─────────────────────────────────────────────────────────────────────────────
// distributions.ts — Exact probability distributions for Haikyū Gauntlet RPG
//
// All functions are pure, unit-testable, and computed via discrete convolution.
// No floating-point magic numbers — all probabilities are exact rationals
// expressed as JS numbers (which are IEEE-754 doubles, sufficient precision here).
// ─────────────────────────────────────────────────────────────────────────────

/** A PMF entry: a value and its probability (sums to 1 across all entries). */
export interface PmfPoint {
  value: number;
  prob: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: PMF of sum of k dice each with sides 1..s
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the exact PMF of the sum of `k` fair dice each with `s` sides
 * (faces 1 through s).  Uses iterative convolution.
 *
 * Sum range: [k, k*s].
 * Total outcomes: s^k.
 */
export function dicesSumPmf(k: number, s: number): PmfPoint[] {
  // Start with a single die
  const singleDie = new Map<number, number>();
  for (let face = 1; face <= s; face++) {
    singleDie.set(face, 1 / s);
  }

  let pmfMap = singleDie;

  // Convolve (k-1) more times
  for (let d = 1; d < k; d++) {
    const next = new Map<number, number>();
    for (const [val, prob] of pmfMap) {
      for (let face = 1; face <= s; face++) {
        const sum = val + face;
        next.set(sum, (next.get(sum) ?? 0) + prob / s);
      }
    }
    pmfMap = next;
  }

  return Array.from(pmfMap.entries())
    .map(([value, prob]) => ({ value, prob }))
    .sort((a, b) => a.value - b.value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Specific PMFs used by the app
// ─────────────────────────────────────────────────────────────────────────────

/** PMF of 3d10 sum (range 3–30). Computed once and cached. */
let _3d10Pmf: PmfPoint[] | null = null;
export function get3d10Pmf(): PmfPoint[] {
  if (!_3d10Pmf) _3d10Pmf = dicesSumPmf(3, 10);
  return _3d10Pmf;
}

/**
 * PMF of 4d4 average (range 1.00–4.00 in 0.25 steps).
 * This is the sum PMF scaled to average by dividing each value by 4.
 */
let _4d4AvgPmf: PmfPoint[] | null = null;
export function get4d4AvgPmf(): PmfPoint[] {
  if (!_4d4AvgPmf) {
    const sumPmf = dicesSumPmf(4, 4);
    _4d4AvgPmf = sumPmf.map(({ value, prob }) => ({
      value: value / 4,
      prob,
    }));
  }
  return _4d4AvgPmf;
}

// ─────────────────────────────────────────────────────────────────────────────
// Physical attribute PMFs (map roll → cm)
// ─────────────────────────────────────────────────────────────────────────────

/** Height cm PMF: Height = 150 + 2 × roll. Population is 3d10 rolls. */
export function heightCmPmf(): PmfPoint[] {
  return get3d10Pmf().map(({ value, prob }) => ({
    value: 150 + 2 * value,
    prob,
  }));
}

/** Vertical cm PMF: Vertical = 45 + 3 × roll. Population is 3d10 rolls. */
export function verticalCmPmf(): PmfPoint[] {
  return get3d10Pmf().map(({ value, prob }) => ({
    value: 45 + 3 * value,
    prob,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Reach PMFs — Height and Vertical are independent 3d10 rolls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the exact PMF of a derived reach by marginalising over all
 * (heightRoll, verticalRoll) combinations.
 *
 * `reachFn(heightCm, verticalCm) → reachCm`
 *
 * Because Height and Vertical are independent, P(h, v) = P(h) × P(v).
 * We collect results into a map keyed by reach value (rounded to avoid
 * floating-point hash misses — reaches are always multiples of 0.1 cm or
 * similar due to 2× and 1.3× factors, but we round to 1 decimal to be safe).
 */
export function reachPmf(
  reachFn: (heightCm: number, verticalCm: number) => number
): PmfPoint[] {
  const h3d10 = get3d10Pmf();
  const v3d10 = get3d10Pmf();
  const result = new Map<number, number>();

  for (const { value: hRoll, prob: hProb } of h3d10) {
    const heightCm = 150 + 2 * hRoll;
    for (const { value: vRoll, prob: vProb } of v3d10) {
      const vertCm = 45 + 3 * vRoll;
      const reach = reachFn(heightCm, vertCm);
      // Round to 2 decimal places to bucket floating-point near-equals
      const key = Math.round(reach * 100) / 100;
      result.set(key, (result.get(key) ?? 0) + hProb * vProb);
    }
  }

  return Array.from(result.entries())
    .map(([value, prob]) => ({ value, prob }))
    .sort((a, b) => a.value - b.value);
}

/** Standing reach PMF: 1.3 × Height */
export function standingReachPmf(): PmfPoint[] {
  return reachPmf((h) => 1.3 * h);
}

/** Spiking reach PMF: 1.3 × Height + Vertical */
export function spikingReachPmf(): PmfPoint[] {
  return reachPmf((h, v) => 1.3 * h + v);
}

/**
 * Blocking reach PMF: 1.3 × Height + coef × Vertical.
 * Pass `coef = 0.9` for Swing Block.
 */
export function blockingReachPmf(coef = 0.85): PmfPoint[] {
  return reachPmf((h, v) => 1.3 * h + coef * v);
}

/**
 * Bin a PMF into whole-number `value` buckets, summing the probabilities of all
 * values that round to the same integer. Used to smooth the visually-spiky reach
 * distributions (which combine two independent rolls into many fine-grained
 * values) into a clean per-cm histogram. Percentiles are still computed from the
 * raw PMF for accuracy.
 */
export function binPmfToIntegers(pmf: PmfPoint[]): PmfPoint[] {
  const buckets = new Map<number, number>();
  for (const { value, prob } of pmf) {
    const key = Math.round(value);
    buckets.set(key, (buckets.get(key) ?? 0) + prob);
  }
  return Array.from(buckets.entries())
    .map(([value, prob]) => ({ value, prob }))
    .sort((a, b) => a.value - b.value);
}

// ─────────────────────────────────────────────────────────────────────────────
// CDF / percentile utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the cumulative probability P(X ≤ value) for a given PMF.
 * `pmf` must be sorted ascending by `value` (all functions above guarantee this).
 */
export function cdfAtOrBelow(value: number, pmf: PmfPoint[]): number {
  let cdf = 0;
  for (const p of pmf) {
    if (p.value <= value) cdf += p.prob;
    else break;
  }
  return Math.min(cdf, 1); // clamp rounding dust
}

/**
 * Returns the percentile rank of `value` in the distribution as a percentage
 * (0–100), using the "at or below" CDF convention (inclusive).
 * Rounds to 1 decimal place.
 */
export function percentileOf(value: number, pmf: PmfPoint[]): number {
  return Math.round(cdfAtOrBelow(value, pmf) * 1000) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanity checks (exported for unit tests / manual verification)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies that probabilities sum to ~1.
 * Returns `true` if |sum - 1| < 1e-9.
 */
export function pmfSumsToOne(pmf: PmfPoint[]): boolean {
  const sum = pmf.reduce((acc, p) => acc + p.prob, 0);
  return Math.abs(sum - 1) < 1e-9;
}

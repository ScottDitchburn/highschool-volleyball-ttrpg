// Per-player derived figures used by the roster list and exports.
// Reuses the builder's pure stat/reach functions so a coach view matches the
// single-character review screen exactly.

import type { Character, SkillStats, DerivedReaches } from '../types';
import { computeEffectiveStats, computeDerived } from '../state/characterStore';

export interface PlayerDerived {
  effectiveStats: SkillStats | null;
  reaches: DerivedReaches | null;
  /** Effective height in cm (base + height-bonus abilities), or null. */
  effectiveHeightCm: number | null;
}

export function deriveForPlayer(character: Character): PlayerDerived {
  const reaches = computeDerived(character);
  return {
    effectiveStats: computeEffectiveStats(character),
    reaches,
    effectiveHeightCm: reaches?.effectiveHeightCm ?? character.physical?.heightCm ?? null,
  };
}

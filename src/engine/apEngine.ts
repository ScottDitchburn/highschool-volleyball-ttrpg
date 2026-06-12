// src/engine/apEngine.ts
// AP Budget Engine -- Milestone 4
//
// INCOME (this file):
//   apIncomeTotal(character) -- total AP the character has earned
//   computeAPBudget(character) -- full APBudget breakdown
//
// SPEND (M5 ability engine owns):
//   computeSpent(character) is also exported here so M5 can import it
//   rather than duplicating the logic.
//
// CONTRACT for M5:
//   - M5 must NOT store AP totals redundantly in character.apBudget.
//   - When M5 selects/deselects abilities it dispatches SELECT_ABILITY /
//     DESELECT_ABILITY / SET_ABILITY_TIER so the reducer updates
//     selectedAbilities. The store re-renders and computeAPBudget() (called
//     by the UI) picks up the new spend automatically.
//   - M5 should import apIncomeTotal and computeSpent from this file.

import type { Character, APBudget } from '../types';
import { ABILITY_MAP } from '../data/abilities';

// -- AP spend (ability costs) --

/**
 * Sum of all selected ability costs (base + tier add-costs up to chosen tier).
 * M5 may import and reuse this rather than duplicating.
 *
 * Tier cost is the sum of addCost for tiers 0..sel.tier-1 (sel.tier=0 means
 * base only, sel.tier=1 means base + first tier addCost, etc.).
 */
export function computeSpent(character: Character): number {
  return character.selectedAbilities.reduce((sum, sel) => {
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability) return sum;
    const tierCost = ability.tiers
      ? ability.tiers.slice(0, sel.tier).reduce((t, tier) => t + tier.addCost, 0)
      : 0;
    return sum + ability.baseCost + tierCost;
  }, 0);
}

// -- AP income (year + experience + level-up) --

/**
 * Total AP income from all sources (base + year bonus + experience + level-ups).
 *
 * M5 should call this instead of reading character.apBudget.total directly.
 *
 * Breakdown:
 *   base            = 10 (always)
 *   yearBonus       = stored in character.apBudget.yearBonus (set by SET_YEAR_ROLL)
 *                     1st year: 0
 *                     2nd year: 3 + rolled 2d4  (stored value, not re-randomised)
 *                     3rd year: 6 + rolled 4d4  (stored value, not re-randomised)
 *   experienceBonus = stored in character.apBudget.experienceBonus (set by SET_EXPERIENCE_ROLL)
 *                     2-3: +0, 4-7: +1, 8-11: +2, 12-15: +3, 16: +4
 *   levelUpGains    = sum of apGained across levelUpHistory (added by LEVEL_UP actions)
 *                     each gain = 3 + 2 * teamsPlayed
 */
export function apIncomeTotal(character: Character): number {
  const { base, yearBonus, experienceBonus, levelUpGains } = character.apBudget;
  return base + yearBonus + experienceBonus + levelUpGains;
}

/**
 * Convenience: AP remaining = income - spend.
 */
export function apRemaining(character: Character): number {
  return apIncomeTotal(character) - computeSpent(character);
}

/**
 * Recomputes the full APBudget from current character state.
 *
 * Hand-check examples:
 *   1st year, no experience:          10 + 0 + 0 + 0 = 10  (correct)
 *   2nd year (2d4=5), exp tier +2:    10 + (3+5) + 2 + 0 = 20  (correct)
 */
export function computeAPBudget(character: Character): APBudget {
  const base             = character.apBudget.base;
  const yearBonus        = character.apBudget.yearBonus;
  const experienceBonus  = character.apBudget.experienceBonus;
  const levelUpGains     = character.apBudget.levelUpGains;
  const total            = base + yearBonus + experienceBonus + levelUpGains;
  const spent            = computeSpent(character);
  const remaining        = total - spent;
  return { base, yearBonus, experienceBonus, levelUpGains, total, spent, remaining };
}

// src/engine/effects.ts
// Shared application of ability Effects to a character's stats and reaches.
//
// Both the live store selectors (state/characterStore) and the prereq engine's
// simulation helpers run the SAME code here, so a new Effect kind only has to
// be taught once. The two callers differ only in how they guard incomplete
// input (the store requires all ten skills; the simulator is lenient).

import type {
  Character,
  ChooseSpec,
  DerivedReaches,
  Effect,
  OptionEffect,
  SkillStat,
  SkillStats,
} from '../types';
import { SKILL_STAT_NAMES } from '../types';
import { ABILITY_MAP } from '../data/abilities';

/**
 * The stats a chooser actually allows: an explicit shortlist as given (the six VB
 * skills, ['Dig','Block'], ['Stamina','IQ'], …), otherwise all ten.
 */
function allowedStats(choose: ChooseSpec): readonly SkillStat[] {
  return Array.isArray(choose) ? choose : SKILL_STAT_NAMES;
}

/**
 * The valid stat picks recorded for a chooser. Anything the chooser does not
 * offer is dropped, so a stale pick from an older save (e.g. a v.2 Training on
 * Power, which v.3 no longer allows) grants nothing and is reported as an
 * outstanding choice rather than silently applying.
 */
export function resolveStatPicks(
  choose: ChooseSpec,
  choice: SkillStat | SkillStat[] | string | undefined,
): SkillStat[] {
  if (choice === undefined) return [];
  const picks = Array.isArray(choice) ? choice : [choice];
  const allowed = allowedStats(choose);
  return picks.filter((pick): pick is SkillStat => allowed.includes(pick as SkillStat));
}

/**
 * The option a player picked for an `optionChoice` effect, or undefined when
 * the choice has not been made yet (unresolved choices apply nothing).
 */
export function resolveOption(
  effect: Extract<Effect, { kind: 'optionChoice' }>,
  choice: SkillStat | SkillStat[] | string | undefined,
) {
  if (typeof choice !== 'string') return undefined;
  return effect.options.find((o) => o.id === choice);
}

/**
 * Every effect that is mechanically ACTIVE on a character right now: each
 * ability's top-level effects, plus the effects of whichever `optionChoice`
 * option each purchased instance recorded.
 *
 * Yields `[effectIndex, effect]`; the index is the chooserSelections key for
 * top-level effects and is re-used (same index) for an option's own effects.
 */
function* activeEffects(
  character: Character,
): Generator<{ index: number; effect: Effect | OptionEffect; choice: SkillStat | SkillStat[] | string | undefined }> {
  for (const sel of character.selectedAbilities) {
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability?.effects) continue;

    for (let index = 0; index < ability.effects.length; index++) {
      const effect = ability.effects[index];
      const choice = sel.chooserSelections[index];

      if (effect.kind === 'optionChoice') {
        const option = resolveOption(effect, choice);
        if (!option?.effects) continue;
        for (const inner of option.effects) {
          yield { index, effect: inner, choice: undefined };
        }
        continue;
      }

      yield { index, effect, choice };
    }
  }
}

/**
 * Apply every selected ability's statDelta effects on top of `baseStats`.
 *
 * - `statDelta` with a concrete `stat`: applied unconditionally.
 * - `statDelta` with `choose`: applied to the stat(s) recorded in
 *   chooserSelections[effectIndex]; an unresolved chooser applies nothing.
 * - `optionChoice`: the recorded option's own statDelta effects are applied;
 *   an unresolved choice applies nothing.
 *
 * Values are NOT clamped: stats may exceed 4.00 via bonuses and may fall below
 * 1.00 via penalties (v.3 Stamina costs). See DATA_NOTES.md.
 */
export function applyStatEffects(character: Character, baseStats: SkillStats): SkillStats {
  const stats: SkillStats = { ...baseStats };

  for (const { effect, choice } of activeEffects(character)) {
    if (effect.kind !== 'statDelta') continue;

    if (effect.stat) {
      stats[effect.stat] = (stats[effect.stat] ?? 0) + effect.delta;
      continue;
    }
    if (!('choose' in effect) || !effect.choose) continue;

    // No choice made yet (or a pick this chooser no longer offers) — skip.
    for (const pick of resolveStatPicks(effect.choose, choice)) {
      stats[pick] = (stats[pick] ?? 0) + effect.delta;
    }
  }

  return stats;
}

/**
 * Reaches from the character's physical attributes plus every active
 * height / vertical / spiking-reach / blocking-coefficient effect.
 *
 * Returns null when physical attributes have not been assigned yet.
 */
export function applyDerivedEffects(character: Character): DerivedReaches | null {
  if (!character.physical) return null;

  let effectiveHeightCm = character.physical.heightCm;
  let effectiveVerticalCm = character.physical.verticalCm;
  let blockingCoef = 0.85;
  let spikingDelta = 0;

  for (const { effect } of activeEffects(character)) {
    switch (effect.kind) {
      case 'heightDelta':
        effectiveHeightCm += effect.cm;
        break;
      case 'verticalDelta':
        effectiveVerticalCm += effect.cm;
        break;
      case 'spikingReachDelta':
        spikingDelta += effect.cm;
        break;
      case 'overrideBlockingCoef':
        blockingCoef = effect.value;
        break;
      default:
        break;
    }
  }

  return {
    effectiveHeightCm,
    effectiveVerticalCm,
    standingReachCm: 1.3 * effectiveHeightCm,
    spikingReachCm: 1.3 * effectiveHeightCm + effectiveVerticalCm + spikingDelta,
    blockingReachCm: 1.3 * effectiveHeightCm + blockingCoef * effectiveVerticalCm,
    blockingCoef,
  };
}

/**
 * True when this purchased instance still owes the player a choice — a
 * `statDelta` chooser with no usable pick recorded (nothing at all, or only
 * stats the chooser does not offer), or an `optionChoice` whose recorded value
 * does not name one of its options.
 */
export function instanceNeedsChooser(
  effects: Effect[] | undefined,
  chooserSelections: Record<number, SkillStat | SkillStat[] | string>,
): boolean {
  if (!effects) return false;
  return effects.some((effect, index) => {
    const choice = chooserSelections[index];
    if (effect.kind === 'optionChoice') return resolveOption(effect, choice) === undefined;
    if (effect.kind === 'statDelta' && effect.choose) {
      return resolveStatPicks(effect.choose, choice).length === 0;
    }
    return false;
  });
}

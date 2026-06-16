// src/engine/prereqEngine.ts
// Full live prereq evaluation engine -- Milestone 5.

import type {
  Prereq,
  Character,
  SkillStats,
  SkillStat,
  DerivedReaches,
  Ability,
} from '../types';
import { SKILL_STAT_NAMES } from '../types';
import { ABILITY_MAP } from '../data/abilities';
import { apRemaining } from './apEngine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrereqResult {
  prereq: Prereq;
  met: boolean;
  label: string;
}

export interface AbilityEvaluation {
  prereqResults: PrereqResult[];
  eligible: boolean;
  maxedOut: boolean;
  affordable: boolean;
  needsChooser: boolean;
  tierCost: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timesSelected(character: Character, abilityId: string): number {
  return character.selectedAbilities.filter((s) => s.abilityId === abilityId).length;
}

function selectedTierIndex(character: Character, abilityId: string): number {
  const instances = character.selectedAbilities.filter((s) => s.abilityId === abilityId);
  if (instances.length === 0) return 0;
  return Math.max(...instances.map((s) => s.tier));
}

/**
 * Cumulative AP cost to reach a given tier index (0-based).
 * tier=0 -> baseCost only.
 * tier=1 -> baseCost + tiers[0].addCost.
 * etc.
 */
export function cumulativeCost(ability: Ability, tier: number): number {
  const tierSum = ability.tiers
    ? ability.tiers.slice(0, tier).reduce((acc, t) => acc + t.addCost, 0)
    : 0;
  return ability.baseCost + tierSum;
}

function toRoman(n: number): string {
  const map: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  return map[n] ?? String(n);
}

function metricLabel(metric: 'standingReach' | 'spikingReach' | 'blockingReach'): string {
  if (metric === 'standingReach') return 'Standing Reach';
  if (metric === 'spikingReach') return 'Spiking Reach';
  return 'Blocking Reach';
}

function evaluateMetaPrereq(
  flag: 'notFirstYear' | 'thirdYear' | 'creationOnly' | 'yearlyOnly',
  character: Character,
): PrereqResult {
  const prereq: Prereq = { kind: 'meta', flag };
  switch (flag) {
    case 'creationOnly':
      return { prereq, met: true, label: 'Select on Character Creation (OK)' };
    case 'yearlyOnly': {
      // Unlocks only when the year has advanced via a Spring Interhigh.
      const hadSpring = character.levelUpHistory.some((r) => r.season === 'spring');
      return {
        prereq,
        met: hadSpring,
        label: hadSpring ? 'Yearly Only (Spring Interhigh -- OK)' : 'Yearly Only (locked until Spring Interhigh)',
      };
    }
    case 'notFirstYear': {
      const met = character.schoolYear > 1;
      return {
        prereq,
        met,
        label: met
          ? `Not First Year (${character.schoolYear === 2 ? '2nd' : '3rd'} year -- OK)`
          : 'Not First Year (currently 1st year -- locked)',
      };
    }
    case 'thirdYear': {
      const met = character.schoolYear === 3;
      return {
        prereq,
        met,
        label: met
          ? 'Third Year (3rd year -- OK)'
          : `Third Year (currently ${character.schoolYear === 1 ? '1st' : '2nd'} year -- locked)`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Single prereq evaluator
// ---------------------------------------------------------------------------

export function evaluatePrereq(
  prereq: Prereq,
  character: Character,
  effectiveStats: SkillStats | null,
  derived: DerivedReaches | null,
): PrereqResult {
  switch (prereq.kind) {
    case 'stat': {
      const val = effectiveStats?.[prereq.stat] ?? null;
      const met = val !== null && val >= prereq.min;
      return {
        prereq,
        met,
        label: `${prereq.stat} ${prereq.min}+${val !== null ? ` (have ${val.toFixed(2)})` : ' (no stats)'}`,
      };
    }

    case 'statAny': {
      if (!effectiveStats) {
        return { prereq, met: false, label: `Any Stat ${prereq.min}+ (no stats assigned)` };
      }
      const best = Math.max(...SKILL_STAT_NAMES.map((s) => effectiveStats[s]));
      const met = best >= prereq.min;
      return { prereq, met, label: `Any Stat ${prereq.min}+ (best: ${best.toFixed(2)})` };
    }

    case 'noStatAtLeast': {
      if (!effectiveStats) {
        return { prereq, met: true, label: `No Stat ${prereq.min}+ (no stats yet -- OK)` };
      }
      const highStat = SKILL_STAT_NAMES.find((s) => effectiveStats[s] >= prereq.min);
      const met = !highStat;
      return {
        prereq,
        met,
        label: highStat
          ? `No Stat ${prereq.min}+ (${highStat} is ${effectiveStats[highStat].toFixed(2)} -- fails)`
          : `No Stat ${prereq.min}+ (all below ${prereq.min} -- OK)`,
      };
    }

    case 'anyStatBelow': {
      // Per-target acquisition gate (Quick Learner): there must be at least one
      // BASE skill below `max` to spend the +0.25 on. Evaluated against base
      // skills (not effective) so a Quick Learner's own bonus can't close the gate.
      const base = character.skills;
      if (!base) {
        return { prereq, met: false, label: `A stat below ${prereq.max} (no stats assigned)` };
      }
      const target = SKILL_STAT_NAMES.find(
        (s) => typeof base[s] === 'number' && base[s] < prereq.max,
      );
      return {
        prereq,
        met: !!target,
        label: target
          ? `A stat below ${prereq.max} (e.g. ${target} ${base[target]!.toFixed(2)})`
          : `A stat below ${prereq.max} (all stats at cap)`,
      };
    }

    case 'derived': {
      if (!derived) {
        return { prereq, met: false, label: `${metricLabel(prereq.metric)} ${prereq.min} cm+ (physical not set)` };
      }
      const val = derived[`${prereq.metric}Cm`] as number;
      const met = val >= prereq.min;
      return {
        prereq,
        met,
        label: `${metricLabel(prereq.metric)} ${prereq.min} cm+ (have ${val.toFixed(1)} cm)`,
      };
    }

    case 'ability': {
      const count = timesSelected(character, prereq.id);
      const abilityName = ABILITY_MAP[prereq.id]?.name ?? prereq.id;

      if (prereq.minTier !== undefined) {
        // Check if ANY instance of the required ability meets the minTier threshold.
        // sel.tier uses the count convention: 0=base/none, 1=Tier I, 2=Tier II, 3=Tier III.
        const bestTier = selectedTierIndex(character, prereq.id); // max tier across all instances
        const hasTier = count > 0 && bestTier >= prereq.minTier;
        const met = hasTier;
        const tierRoman = toRoman(prereq.minTier);
        return {
          prereq,
          met,
          label: met
            ? `${abilityName} Tier ${tierRoman} (have Tier ${toRoman(bestTier)})`
            : count > 0
              ? `${abilityName} Tier ${tierRoman} required (have Tier ${toRoman(bestTier)})`
              : `${abilityName} Tier ${tierRoman} required (not purchased)`,
        };
      }

      const met = count > 0;
      return {
        prereq,
        met,
        label: met ? `${abilityName} (owned)` : `${abilityName} (not purchased)`,
      };
    }

    case 'meta':
      return evaluateMetaPrereq(prereq.flag, character);

    case 'or': {
      const subResults = prereq.any.map((sub) =>
        evaluatePrereq(sub, character, effectiveStats, derived)
      );
      const met = subResults.some((r) => r.met);
      const label = subResults.map((r) => r.label).join(' OR ');
      return { prereq, met, label };
    }
  }
}

// ---------------------------------------------------------------------------
// All-prereqs evaluator
// ---------------------------------------------------------------------------

export function evaluateAllPrereqs(
  prereqs: Prereq[],
  character: Character,
  effectiveStats: SkillStats | null,
  derived: DerivedReaches | null,
): { results: PrereqResult[]; allMet: boolean } {
  const results = prereqs.map((p) => evaluatePrereq(p, character, effectiveStats, derived));
  return { results, allMet: results.every((r) => r.met) };
}

// ---------------------------------------------------------------------------
// Full ability evaluator
// ---------------------------------------------------------------------------

export function evaluateAbility(
  ability: Ability,
  character: Character,
  effectiveStats: SkillStats | null,
  derived: DerivedReaches | null,
  desiredTierIndex = 0,
): AbilityEvaluation {
  const { results: prereqResults, allMet } = evaluateAllPrereqs(
    ability.prereqs,
    character,
    effectiveStats,
    derived,
  );

  const count = timesSelected(character, ability.id);
  // repeatable=true never maxes out; otherwise cap is maxTimes ?? 1.
  const maxedOut = ability.repeatable ? false : count >= (ability.maxTimes ?? 1);

  // For a new purchase, the cost is the full baseCost (+ tier if tiered).
  // Each instance is independent; we do NOT subtract already-spent from a prior instance.
  const desiredCost = cumulativeCost(ability, desiredTierIndex);
  const currentRemaining = apRemaining(character);
  const affordable = desiredCost <= currentRemaining;

  // needsChooser: true if ANY existing instance is missing a required chooser selection
  let needsChooser = false;
  if (ability.effects) {
    const instances = character.selectedAbilities.filter((s) => s.abilityId === ability.id);
    outer: for (const inst of instances) {
      for (let i = 0; i < ability.effects.length; i++) {
        const effect = ability.effects[i];
        if (effect.kind === 'statDelta' && effect.choose) {
          if (!inst.chooserSelections[i]) {
            needsChooser = true;
            break outer;
          }
        }
      }
    }
  }

  return {
    prereqResults,
    eligible: allMet && !maxedOut,
    maxedOut,
    affordable,
    needsChooser,
    tierCost: desiredCost,
  };
}

// ---------------------------------------------------------------------------
// Cascade guard
// ---------------------------------------------------------------------------

export function findCascadeDependents(
  removedUid: string,
  newTier: number | null,
  character: Character,
  _effectiveStats: SkillStats | null,
  _derived: DerivedReaches | null,
): Array<{ uid: string; abilityId: string; name: string; reason: string }> {
  // Simulate the removal/tier-change of the specific instance by uid
  const simulatedAbilities = character.selectedAbilities
    .map((sel) => {
      if (sel.uid !== removedUid) return sel;
      if (newTier === null) return null;
      return { ...sel, tier: newTier };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const simCharacter = { ...character, selectedAbilities: simulatedAbilities };
  const simEffective = computeSimEffectiveStats(simCharacter);
  const simDerived = computeSimDerived(simCharacter);

  const dependents: Array<{ uid: string; abilityId: string; name: string; reason: string }> = [];

  for (const sel of character.selectedAbilities) {
    if (sel.uid === removedUid) continue;
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability) continue;

    const { results } = evaluateAllPrereqs(ability.prereqs, simCharacter, simEffective, simDerived);
    const broken = results.filter((r) => !r.met);
    if (broken.length > 0) {
      dependents.push({
        uid: sel.uid,
        abilityId: sel.abilityId,
        name: ability.name,
        reason: broken.map((r) => r.label).join('; '),
      });
    }
  }

  return dependents;
}

// ---------------------------------------------------------------------------
// Validation sweep — find owned abilities whose prereqs are no longer met
// ---------------------------------------------------------------------------

export interface IneligibleAbility {
  uid: string;
  abilityId: string;
  name: string;
  reason: string;
}

/**
 * Sweep every owned ability and return those whose prereqs are no longer
 * satisfied against the character's CURRENT state (stats, reaches, year, etc.).
 *
 * Runs iteratively so prerequisite chains resolve fully: if removing a
 * now-invalid ability (because its own prereq broke, or it was a stat source)
 * causes another owned ability to fail, that dependent is caught on the next
 * pass. Keeps going until the kept set is stable.
 *
 * Pure: does not mutate the character. The caller decides whether to prune.
 */
/**
 * Inverse "acquisition gate" prereqs only restrict TAKING an ability — they must
 * not retroactively remove an owned copy when the gate later closes. (Quick
 * Learner's own +0.25 would otherwise trip its own gate the instant it applies.)
 */
const ACQUISITION_GATE_KINDS = new Set<Prereq['kind']>(['anyStatBelow', 'noStatAtLeast']);

export function findIneligibleAbilities(character: Character): IneligibleAbility[] {
  let kept = [...character.selectedAbilities];
  const removed: IneligibleAbility[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    const simCharacter = { ...character, selectedAbilities: kept };
    const simEffective = computeSimEffectiveStats(simCharacter);
    const simDerived = computeSimDerived(simCharacter);

    const stillKept: typeof kept = [];
    for (const sel of kept) {
      const ability = ABILITY_MAP[sel.abilityId];
      if (!ability) {
        stillKept.push(sel);
        continue;
      }
      const { results } = evaluateAllPrereqs(
        ability.prereqs,
        simCharacter,
        simEffective,
        simDerived,
      );
      const broken = results.filter(
        (r) => !r.met && !ACQUISITION_GATE_KINDS.has(r.prereq.kind),
      );

      const reason: string | null =
        broken.length > 0 ? broken.map((r) => r.label).join('; ') : null;

      if (reason === null) {
        stillKept.push(sel);
      } else {
        removed.push({
          uid: sel.uid,
          abilityId: sel.abilityId,
          name: ability.name,
          reason,
        });
        changed = true;
      }
    }
    kept = stillKept;
  }

  return removed;
}

// ---------------------------------------------------------------------------
// Simulation helpers (mirrors store logic to avoid circular import)
// ---------------------------------------------------------------------------

function computeSimEffectiveStats(character: Character): SkillStats | null {
  if (!character.skills) return null;
  const stats = { ...character.skills };

  for (const sel of character.selectedAbilities) {
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability?.effects) continue;

    ability.effects.forEach((effect, idx) => {
      if (effect.kind !== 'statDelta') return;
      if (effect.stat) {
        stats[effect.stat] = (stats[effect.stat] ?? 0) + effect.delta;
      } else if (effect.choose) {
        const chosen = sel.chooserSelections[idx];
        if (!chosen) return;
        if (Array.isArray(chosen)) {
          (chosen as SkillStat[]).forEach((s) => {
            stats[s] = (stats[s] ?? 0) + effect.delta;
          });
        } else {
          const s = chosen as SkillStat;
          stats[s] = (stats[s] ?? 0) + effect.delta;
        }
      }
    });
  }

  return stats;
}

function computeSimDerived(character: Character): DerivedReaches | null {
  if (!character.physical) return null;
  let h = character.physical.heightCm;
  let coef = 0.85;
  let spikeDelta = 0;

  for (const sel of character.selectedAbilities) {
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability?.effects) continue;
    for (const effect of ability.effects) {
      if (effect.kind === 'heightDelta') h += effect.cm;
      else if (effect.kind === 'overrideBlockingCoef') coef = effect.value;
      else if (effect.kind === 'spikingReachDelta') spikeDelta += effect.cm;
    }
  }

  const v = character.physical.verticalCm;
  return {
    effectiveHeightCm: h,
    standingReachCm: 1.3 * h,
    spikingReachCm: 1.3 * h + v + spikeDelta,
    blockingReachCm: 1.3 * h + coef * v,
    blockingCoef: coef,
  };
}

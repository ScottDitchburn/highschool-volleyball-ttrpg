// Character Store -- React Context + useReducer
// Single source of truth for the entire character-builder session.

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from 'react';

import { autosave, loadSaved, clearSaved } from './persistence';

import {
  type Character,
  type PhysicalRoll,
  type SkillRoll,
  type SkillStat,
  type SchoolYear,
  type YearRoll,
  type SelectedAbility,
  type DerivedReaches,
  type SkillStats,
  type APBudget,
  type InterhighSeason,
  type LevelUpRecord,
  computeReaches,
  rollToHeightCm,
  rollToVerticalCm,
  experienceFromRoll,
  interhighAp,
  SKILL_STAT_NAMES,
} from '../types';

import { ABILITY_MAP } from '../data/abilities';
import { computeSpent } from '../engine/apEngine';
import { findIneligibleAbilities } from '../engine/prereqEngine';
import {
  seededPhysicalRoll, seededSkillChip, seededYear, seededYearBonus, seededExperienceRoll,
} from '../rng/seeded';

// ---------------------------------------------------------------------------
// UID generator (crypto.randomUUID with fallback)
// ---------------------------------------------------------------------------

export function generateUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const DEFAULT_AP_BUDGET: APBudget = {
  base: 10,
  yearBonus: 0,
  experienceBonus: 0,
  levelUpGains: 0,
  total: 10,
  spent: 0,
  remaining: 10,
};

export const INITIAL_CHARACTER: Character = {
  name: '',
  schoolYear: 1,
  graduated: false,
  physicalPool: { rollA: null, rollB: null },
  physical: null,
  reaches: null,
  skillPool: { rolls: Array(10).fill(null) },
  skills: null,
  yearRoll: null,
  experience: null,
  apBudget: DEFAULT_AP_BUDGET,
  selectedAbilities: [],
  levelUpHistory: [],
  seed: null,
  seeded: false,
};

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type CharacterAction =
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_PHYSICAL_ROLL_A'; roll: PhysicalRoll }
  | { type: 'SET_PHYSICAL_ROLL_B'; roll: PhysicalRoll }
  | { type: 'ASSIGN_PHYSICAL'; heightRoll: number; verticalRoll: number }
  | { type: 'SET_SKILL_ROLL'; index: number; roll: SkillRoll }
  | { type: 'ASSIGN_SKILL'; index: number; stat: SkillStat }
  | { type: 'CLEAR_SKILL_ASSIGNMENT'; stat: SkillStat }
  | { type: 'SET_YEAR_ROLL'; roll: YearRoll; yearBonus?: number }
  | { type: 'SET_EXPERIENCE_ROLL'; roll: number }
  | { type: 'SELECT_ABILITY'; abilityId: string }
  | { type: 'DESELECT_ABILITY'; uid: string }
  | { type: 'PRUNE_ABILITIES'; uids: string[] }
  | { type: 'SET_ABILITY_TIER'; uid: string; tier: number }
  | { type: 'SET_ABILITY_CHOOSER'; uid: string; effectIndex: number; choice: SkillStat | SkillStat[] }
  | { type: 'INTERHIGH'; season: InterhighSeason; prelimGames: number; nationalGames: number; heightGainCm: number }
  | { type: 'START_SEEDED_RUN'; seed: string }
  | { type: 'IMPORT_CHARACTER'; character: Character }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function baseCharacterReducer(state: Character, action: CharacterAction): Character {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.name };

    case 'START_SEEDED_RUN': {
      const seed = action.seed;
      const rollA = seededPhysicalRoll(seed, 0);
      const rollB = seededPhysicalRoll(seed, 1);
      const skillRolls = Array.from({ length: 10 }, (_, i) => {
        const c = seededSkillChip(seed, i);
        return { dice: c.dice, value: c.value };
      });
      const year = seededYear(seed);
      const yb = seededYearBonus(seed, year);
      const exp = experienceFromRoll(seededExperienceRoll(seed).roll);
      const base = state.apBudget.base;
      const total = base + yb.bonus + exp.bonus;
      const apBudget = {
        ...DEFAULT_AP_BUDGET,
        base, yearBonus: yb.bonus, experienceBonus: exp.bonus,
        levelUpGains: 0, spent: 0, total, remaining: total,
      };
      return {
        ...state,
        seed, seeded: true,
        physicalPool: { rollA: { dice: rollA.dice, total: rollA.total }, rollB: { dice: rollB.dice, total: rollB.total } },
        physical: null,
        reaches: null,
        skillPool: { rolls: skillRolls },
        skills: null,
        yearRoll: year,
        schoolYear: year,
        graduated: false,
        experience: exp,
        apBudget,
        selectedAbilities: [],
        levelUpHistory: [],
      };
    }

    case 'SET_PHYSICAL_ROLL_A':
      return { ...state, physicalPool: { ...state.physicalPool, rollA: action.roll } };

    case 'SET_PHYSICAL_ROLL_B':
      return { ...state, physicalPool: { ...state.physicalPool, rollB: action.roll } };

    case 'ASSIGN_PHYSICAL': {
      const heightCm   = rollToHeightCm(action.heightRoll);
      const verticalCm = rollToVerticalCm(action.verticalRoll);
      const physical   = { heightRoll: action.heightRoll, verticalRoll: action.verticalRoll, heightCm, verticalCm };
      const reaches    = computeReaches(heightCm, verticalCm);
      return { ...state, physical, reaches };
    }

    case 'SET_SKILL_ROLL': {
      const rolls = [...state.skillPool.rolls];
      rolls[action.index] = action.roll;
      return { ...state, skillPool: { rolls } };
    }

    case 'ASSIGN_SKILL': {
      const roll = state.skillPool.rolls[action.index];
      if (!roll) return state;
      const prevSkills = state.skills ?? ({} as SkillStats);
      const newSkills: Partial<SkillStats> = { ...prevSkills, [action.stat]: roll.value };
      return { ...state, skills: newSkills as SkillStats };
    }

    case 'CLEAR_SKILL_ASSIGNMENT': {
      if (!state.skills) return state;
      const newSkills = { ...state.skills } as Partial<SkillStats>;
      delete newSkills[action.stat];
      const remaining = Object.keys(newSkills).length;
      return {
        ...state,
        skills: remaining > 0 ? (newSkills as SkillStats) : null,
      };
    }

    case 'SET_YEAR_ROLL': {
      const yearMap: Record<YearRoll, SchoolYear> = { 1: 1, 2: 2, 3: 3 };
      const schoolYear = yearMap[action.roll];
      // yearBonus is supplied by the step after the bonus-dice are rolled:
      //   1st year: 0
      //   2nd year: 3 + rolled 2d4  (action.yearBonus carries the full bonus)
      //   3rd year: 6 + rolled 4d4  (action.yearBonus carries the full bonus)
      const yearBonus = action.yearBonus ?? 0;
      const newTotal  = state.apBudget.base + yearBonus + state.apBudget.experienceBonus + state.apBudget.levelUpGains;
      const newBudget = { ...state.apBudget, yearBonus, total: newTotal };
      return {
        ...state,
        yearRoll: action.roll,
        schoolYear,
        apBudget: { ...newBudget, remaining: newBudget.total - newBudget.spent },
      };
    }

    case 'SET_EXPERIENCE_ROLL': {
      const exp = experienceFromRoll(action.roll);
      const newBudget = {
        ...state.apBudget,
        experienceBonus: exp.bonus,
        total: state.apBudget.base + state.apBudget.yearBonus + exp.bonus + state.apBudget.levelUpGains,
      };
      return {
        ...state,
        experience: exp,
        apBudget: { ...newBudget, remaining: newBudget.total - newBudget.spent },
      };
    }

    case 'SELECT_ABILITY': {
      const ability = ABILITY_MAP[action.abilityId];
      if (!ability) return state;
      const count = state.selectedAbilities.filter(a => a.abilityId === action.abilityId).length;
      // Cap: repeatable=true is uncapped; otherwise limit is maxTimes ?? 1 (single purchase by default).
      if (!ability.repeatable) {
        const cap = ability.maxTimes ?? 1;
        if (count >= cap) return state;
      }
      const initialTier = ability.tiers && ability.tiers.length > 0 ? 1 : 0;
      const newInstance: SelectedAbility = {
        uid: generateUid(),
        abilityId: action.abilityId,
        tier: initialTier,
        chooserSelections: {},
      };
      return {
        ...state,
        selectedAbilities: [...state.selectedAbilities, newInstance],
      };
    }

    case 'DESELECT_ABILITY':
      return {
        ...state,
        selectedAbilities: state.selectedAbilities.filter(a => a.uid !== action.uid),
      };

    case 'PRUNE_ABILITIES': {
      if (action.uids.length === 0) return state;
      const drop = new Set(action.uids);
      return {
        ...state,
        selectedAbilities: state.selectedAbilities.filter(a => !drop.has(a.uid)),
      };
    }

    case 'SET_ABILITY_TIER':
      return {
        ...state,
        selectedAbilities: state.selectedAbilities.map(a =>
          a.uid === action.uid ? { ...a, tier: action.tier } : a
        ),
      };

    case 'SET_ABILITY_CHOOSER':
      return {
        ...state,
        selectedAbilities: state.selectedAbilities.map(a => {
          if (a.uid !== action.uid) return a;
          return {
            ...a,
            chooserSelections: {
              ...a.chooserSelections,
              [action.effectIndex]: action.choice,
            },
          };
        }),
      };

    case 'INTERHIGH': {
      // Both events award AP = (2 × prelim) + (3 × national).
      const apGained = interhighAp(action.prelimGames, action.nationalGames);
      const newLevelGains = state.apBudget.levelUpGains + apGained;
      const newBudget = {
        ...state.apBudget,
        levelUpGains: newLevelGains,
        total: state.apBudget.base + state.apBudget.yearBonus + state.apBudget.experienceBonus + newLevelGains,
      };

      // Summer Interhigh: AP only — no year advance, no height, no unlocks.
      if (action.season === 'summer') {
        const record: LevelUpRecord = {
          season: 'summer',
          year: state.schoolYear,
          prelimGames: action.prelimGames,
          nationalGames: action.nationalGames,
          apGained,
          heightGainCm: 0,
        };
        return {
          ...state,
          apBudget: { ...newBudget, remaining: newBudget.total - newBudget.spent },
          levelUpHistory: [...state.levelUpHistory, record],
        };
      }

      // Spring Interhigh: AP + height growth + advance year (or graduate at 3rd year).
      const graduating = state.schoolYear >= 3;
      const nextYear = (graduating ? state.schoolYear : state.schoolYear + 1) as SchoolYear;
      const heightCm = state.physical
        ? state.physical.heightCm + action.heightGainCm
        : undefined;
      const newPhysical = state.physical && heightCm !== undefined
        ? { ...state.physical, heightCm }
        : state.physical;
      const newReaches = newPhysical
        ? computeReaches(newPhysical.heightCm, newPhysical.verticalCm)
        : state.reaches;
      const record: LevelUpRecord = {
        season: 'spring',
        year: state.schoolYear,
        prelimGames: action.prelimGames,
        nationalGames: action.nationalGames,
        apGained,
        heightGainCm: action.heightGainCm,
        graduated: graduating || undefined,
      };
      return {
        ...state,
        schoolYear: nextYear,
        graduated: graduating ? true : state.graduated,
        physical: newPhysical,
        reaches: newReaches,
        apBudget: { ...newBudget, remaining: newBudget.total - newBudget.spent },
        levelUpHistory: [...state.levelUpHistory, record],
      };
    }

    case 'IMPORT_CHARACTER':
      return action.character;

    case 'RESET':
      return INITIAL_CHARACTER;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Computed selectors (M5 full engine)
// ---------------------------------------------------------------------------

/**
 * Compute effective skill stats = base assigned skills + all selected ability statDelta effects.
 *
 * Rules:
 * - statDelta with a concrete stat: add delta unconditionally.
 * - statDelta with choose:'any' or choose:['Dig','Block'] or choose:'twoSkills':
 *     apply delta to the stat(s) stored in chooserSelections[effectIndex].
 *     If no choice made yet, skip (ability needs a chooser selection).
 * - Special case: id === 'aggressive-spiker', effectIndex 1 (the penalty effect encoded
 *     as choose:['Dig','Block']) → the chooser actually stores Stamina or IQ.
 *     We handle it the same way (just read from chooserSelections), so the actual
 *     stored stat (Stamina or IQ) is applied correctly regardless of the encoded type.
 * - Skills can exceed 4.00 via bonuses; do NOT clamp.
 * - Returns null if base skills haven't been assigned yet.
 */
export function computeEffectiveStats(character: Character): SkillStats | null {
  if (!character.skills) return null;
  // Effective stats are only meaningful once ALL ten skills are assigned.
  // A partial skills object would yield undefined stat values and crash consumers
  // (which all guard with `if (effectiveStats)` expecting a complete block).
  if (!SKILL_STAT_NAMES.every((s) => typeof character.skills![s] === 'number')) return null;

  // Start from a mutable copy of base stats
  const stats: SkillStats = { ...character.skills };

  for (const sel of character.selectedAbilities) {
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability || !ability.effects) continue;

    ability.effects.forEach((effect, effectIndex) => {
      if (effect.kind !== 'statDelta') return;

      if (effect.stat) {
        // Concrete stat: apply directly
        stats[effect.stat] = (stats[effect.stat] ?? 0) + effect.delta;
      } else if (effect.choose) {
        // Chooser: read from chooserSelections
        const chosen = sel.chooserSelections[effectIndex];
        if (!chosen) return; // no choice made yet — skip

        if (Array.isArray(chosen)) {
          // twoSkills: chosen is SkillStat[]
          for (const s of chosen as SkillStat[]) {
            if (SKILL_STAT_NAMES.includes(s as typeof SKILL_STAT_NAMES[number])) {
              stats[s as SkillStat] = (stats[s as SkillStat] ?? 0) + effect.delta;
            }
          }
        } else {
          // single stat chooser (any, ['Dig','Block'], or aggressive-spiker's Stamina/IQ)
          const s = chosen as SkillStat;
          if (SKILL_STAT_NAMES.includes(s as typeof SKILL_STAT_NAMES[number])) {
            stats[s] = (stats[s] ?? 0) + effect.delta;
          }
        }
      }
    });
  }

  return stats;
}

/**
 * Compute effective derived reaches  * - heightDelta effects (e.g. Growth Spurt +8 cm)
 * - overrideBlockingCoef (e.g. Swing Block 0.85 to 0.9)
 * - spikingReachDelta (e.g. Boom Jump +6 cm)
 *
 * Returns null if physical attributes have not been assigned yet.
 */
export function computeDerived(character: Character): DerivedReaches | null {
  if (!character.physical) return null;

  let effectiveHeightCm = character.physical.heightCm;
  let blockingCoef = 0.85;
  let spikingDelta = 0;

  for (const sel of character.selectedAbilities) {
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability || !ability.effects) continue;

    for (const effect of ability.effects) {
      if (effect.kind === 'heightDelta') {
        effectiveHeightCm += effect.cm;
      } else if (effect.kind === 'overrideBlockingCoef') {
        blockingCoef = effect.value;
      } else if (effect.kind === 'spikingReachDelta') {
        spikingDelta += effect.cm;
      }
    }
  }

  const verticalCm = character.physical.verticalCm;
  return {
    effectiveHeightCm,
    standingReachCm: 1.3 * effectiveHeightCm,
    spikingReachCm:  1.3 * effectiveHeightCm + verticalCm + spikingDelta,
    blockingReachCm: 1.3 * effectiveHeightCm + blockingCoef * verticalCm,
    blockingCoef,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CharacterContextValue {
  character: Character;
  dispatch: React.Dispatch<CharacterAction>;
  effectiveStats: SkillStats | null;
  derivedReaches: DerivedReaches | null;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

// Keep apBudget.spent/remaining in sync with the selected abilities after every
// action, so all readers (live sheet, Year/Exp step, Print & Discord exports)
// show correct AP without each recomputing.
export function characterReducer(state: Character, action: CharacterAction): Character {
  const next = baseCharacterReducer(state, action);
  const spent = computeSpent(next);
  const remaining = next.apBudget.total - spent;
  if (next.apBudget.spent === spent && next.apBudget.remaining === remaining) return next;
  return { ...next, apBudget: { ...next.apBudget, spent, remaining } };
}

function initCharacter(): Character {
  return loadSaved() ?? INITIAL_CHARACTER;
}

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [character, dispatch] = useReducer(characterReducer, undefined, initCharacter);

  const effectiveStats  = computeEffectiveStats(character);
  const derivedReaches  = computeDerived(character);

  useEffect(() => {
    autosave(character);
  }, [character]);

  // Validation sweep: whenever the character changes (e.g. stats reassigned on
  // the Skills step, year advanced), re-check every owned ability's prereqs.
  // Any that no longer qualify are auto-removed and broadcast so the UI can
  // show a notice. Runs after commit; the prune dispatch settles in one pass
  // because the next sweep finds nothing to remove.
  useEffect(() => {
    const ineligible = findIneligibleAbilities(character);
    if (ineligible.length === 0) return;
    dispatch({ type: 'PRUNE_ABILITIES', uids: ineligible.map((d) => d.uid) });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('haikyu:abilities-pruned', { detail: { removed: ineligible } }),
      );
    }
  }, [character]);

  const wrappedDispatch: React.Dispatch<CharacterAction> = React.useCallback(
    (action: CharacterAction) => {
      if (action.type === 'RESET') {
        clearSaved();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('haikyu:reset'));
        }
      }
      dispatch(action);
    },
    [dispatch]
  );

  return (
    <CharacterContext.Provider value={{ character, dispatch: wrappedDispatch, effectiveStats, derivedReaches }}>
      {children}
    </CharacterContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCharacter(): CharacterContextValue {
  const ctx = useContext(CharacterContext);
  if (!ctx) {
    throw new Error('useCharacter must be used within a CharacterProvider');
  }
  return ctx;
}

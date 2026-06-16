// ─────────────────────────────────────────────────────────────────────────────
// Haikyū: Gauntlet RPG v2 — Domain Types
// All derived from PLAN.md §2 / §3.  Do NOT edit the schema below without
// updating DATA_NOTES.md and the abilities data module.
// ─────────────────────────────────────────────────────────────────────────────

// ── Physical rolls ────────────────────────────────────────────────────────────

/**
 * A single 3d10 pool roll result.
 * `dice` holds the three individual face values; `total` is their sum (3–30).
 */
export interface PhysicalRoll {
  dice: [number, number, number];
  total: number; // 3–30
}

/**
 * The two physical pool rolls before assignment.
 * Either can be assigned to Height or Vertical Jump.
 */
export interface PhysicalPool {
  rollA: PhysicalRoll | null;
  rollB: PhysicalRoll | null;
}

// ── Physical attributes (post-assignment) ─────────────────────────────────────

export interface PhysicalAttributes {
  heightRoll: number;   // 3–30, assigned from pool
  verticalRoll: number; // 3–30, assigned from pool
  /** Height in cm = 150 + 2 × heightRoll */
  heightCm: number;
  /** Vertical jump in cm = 45 + 3 × verticalRoll */
  verticalCm: number;
}

// ── Derived reaches ───────────────────────────────────────────────────────────

export interface DerivedReaches {
  /** Effective height in cm (base + ability height bonuses e.g. Growth Spurt) */
  effectiveHeightCm: number;
  /** 1.3 × Height */
  standingReachCm: number;
  /** 1.3 × Height + Vertical */
  spikingReachCm: number;
  /** 1.3 × Height + blockingCoef × Vertical (default coef = 0.85) */
  blockingReachCm: number;
  /** Coefficient used for blocking reach (default 0.85; Swing Block overrides to 0.9) */
  blockingCoef: number;
}

// ── Skill stats ───────────────────────────────────────────────────────────────

export const SKILL_STAT_NAMES = [
  'Spike',
  'Serve',
  'Pass',
  'Dig',
  'Set',
  'Block',
  'Speed',
  'Power',
  'IQ',
  'Stamina',
] as const;

export type SkillStat = typeof SKILL_STAT_NAMES[number];

/**
 * A single 4d4 pool roll result.
 * `dice` holds four face values; `value` = average (1.00–4.00, step 0.25).
 */
export interface SkillRoll {
  dice: [number, number, number, number];
  value: number; // 1.00–4.00
}

/**
 * Ten skill values (1.00–4.00 each) after pool assignment.
 */
export type SkillStats = Record<SkillStat, number>;

/** Ten-slot pool of skill rolls before assignment */
export interface SkillPool {
  rolls: (SkillRoll | null)[];  // length 10
}

// ── School year & experience ──────────────────────────────────────────────────

export type SchoolYear = 1 | 2 | 3;

/** 1d3 result → school year */
export type YearRoll = 1 | 2 | 3;

/** 2d8 result → experience bonus mapping */
export interface ExperienceResult {
  roll: number;  // 2–16
  bonus: number; // 0–4 AP
  label: string; // "No Experience" | "Recreational Player" | etc.
}

// ── Ability Point budget ──────────────────────────────────────────────────────

export interface APBudget {
  base: number;          // always 10
  yearBonus: number;     // 1st=0, 2nd=3+2d4, 3rd=6+4d4
  experienceBonus: number; // 0–4
  levelUpGains: number;  // cumulative gains from year advances
  total: number;         // base + yearBonus + experienceBonus + levelUpGains
  spent: number;         // sum of costs of selected abilities (with tiers)
  remaining: number;     // total − spent
}

// ── Ability schema (PLAN.md §3) ───────────────────────────────────────────────

export type Prereq =
  | { kind: 'stat'; stat: SkillStat; min: number }
  | { kind: 'statAny'; min: number }
  | { kind: 'noStatAtLeast'; min: number }           // inverse — every stat must be below min
  | { kind: 'anyStatBelow'; max: number }            // Quick Learner — at least one base skill below max (a valid boost target exists)
  | { kind: 'derived'; metric: 'standingReach' | 'spikingReach' | 'blockingReach'; min: number }
  | { kind: 'ability'; id: string; minTier?: number }
  | { kind: 'meta'; flag: 'notFirstYear' | 'thirdYear' | 'creationOnly' | 'yearlyOnly' }
  | { kind: 'or'; any: Prereq[] };

export type Effect =
  | { kind: 'statDelta'; stat?: SkillStat; choose?: 'any' | 'twoSkills' | ['Dig', 'Block']; delta: number }
  | { kind: 'heightDelta'; cm: number }
  | { kind: 'spikingReachDelta'; cm: number }
  | { kind: 'overrideBlockingCoef'; value: number };  // Swing Block: 0.85 → 0.9

export interface AbilityTier {
  label: string;    // e.g. "Oikawa Serve"
  addCost: number;  // additional cumulative AP to reach this tier
}

export interface Ability {
  id: string;
  name: string;
  baseCost: number;            // AP
  maxTimes?: number;           // from "(N)". Undefined = single purchase (1).
  repeatable?: boolean;        // true = uncapped repeat purchases (e.g. Training). Default single.
  prereqs: Prereq[];           // ALL must pass (AND); OR encoded as one Prereq node
  tiers?: AbilityTier[];       // cumulative when summed up to chosen tier
  effects?: Effect[];          // stat/derived modifiers, choosers
  meta?: ('creationOnly' | 'yearlyOnly' | 'notFirstYear' | 'thirdYear')[];
  notes?: string;              // surfaced in DATA_NOTES.md
}

// ── Selected ability (character state) ────────────────────────────────────────

export interface SelectedAbility {
  /** Unique instance id — generated with crypto.randomUUID() at selection time.
   *  Allows multiple purchases of the same abilityId (e.g. Training, Quick Learner).
   */
  uid: string;
  abilityId: string;
  /** 0 = base tier, 1 = tier II, etc. (index into ability.tiers array if present) */
  tier: number;
  /**
   * For abilities with chooser effects (e.g. "any Stat", "Dig or Block").
   * Keys are the effect index; values are the chosen stat name(s).
   */
  chooserSelections: Record<number, SkillStat | SkillStat[]>;
}

// ── Level-up history ──────────────────────────────────────────────────────────

/** Each school year has two Interhigh level-up events. */
export type InterhighSeason = 'summer' | 'spring';

export interface LevelUpRecord {
  season: InterhighSeason;
  year: SchoolYear;        // the school year this event occurred in
  prelimGames: number;     // user-entered
  nationalGames: number;   // user-entered
  apGained: number;        // (2 × prelimGames) + (3 × nationalGames)
  heightGainCm: number;    // 1d20 × 0.1 on Spring; 0 on Summer
  graduated?: boolean;     // true only for the 3rd-year Spring event
}

/** AP awarded by either Interhigh event from its game counts. */
export function interhighAp(prelimGames: number, nationalGames: number): number {
  return 2 * prelimGames + 3 * nationalGames;
}

// ── Full character ────────────────────────────────────────────────────────────

export interface Character {
  name: string;
  schoolYear: SchoolYear;

  /** True once the 3rd-year Spring Interhigh has been applied (year shows "Graduate"). */
  graduated?: boolean;

  /** Raw pool rolls (nullable until rolled) */
  physicalPool: PhysicalPool;

  /** Assigned physical attributes (null until both slots assigned) */
  physical: PhysicalAttributes | null;

  /** Reaches computed from physical + active ability effects */
  reaches: DerivedReaches | null;

  /** Raw skill pool rolls */
  skillPool: SkillPool;

  /** Assigned skill stats (null until all 10 slots filled) */
  skills: SkillStats | null;

  /** Year roll result */
  yearRoll: YearRoll | null;

  /** Experience roll result */
  experience: ExperienceResult | null;

  /** Full AP budget */
  apBudget: APBudget;

  /** Abilities the character has purchased */
  selectedAbilities: SelectedAbility[];

  /** History of level-up events */
  levelUpHistory: LevelUpRecord[];

  /** Seeded run: the seed string (null when not a seeded run) */
  seed: string | null;
  /** True when this is a seeded run (rolls locked & derived from the seed) */
  seeded: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion helpers (PLAN.md §2)
// ─────────────────────────────────────────────────────────────────────────────

/** Height in cm from 3d10 roll total: 150 + 2 × roll */
export function rollToHeightCm(roll: number): number {
  return 150 + 2 * roll;
}

/** Vertical jump in cm from 3d10 roll total: 45 + 3 × roll */
export function rollToVerticalCm(roll: number): number {
  return 45 + 3 * roll;
}

/** Standing reach in cm: 1.3 × Height */
export function standingReach(heightCm: number): number {
  return 1.3 * heightCm;
}

/** Spiking reach in cm: 1.3 × Height + Vertical */
export function spikingReach(heightCm: number, verticalCm: number): number {
  return 1.3 * heightCm + verticalCm;
}

/**
 * Blocking reach in cm: 1.3 × Height + coef × Vertical.
 * Default coef = 0.85; Swing Block ability overrides to 0.9.
 */
export function blockingReach(
  heightCm: number,
  verticalCm: number,
  coef = 0.85
): number {
  return 1.3 * heightCm + coef * verticalCm;
}

/** Compute all three reaches from physical attributes and an optional blocking coef. */
export function computeReaches(
  heightCm: number,
  verticalCm: number,
  blockingCoef = 0.85
): DerivedReaches {
  return {
    effectiveHeightCm: heightCm,
    standingReachCm: standingReach(heightCm),
    spikingReachCm:  spikingReach(heightCm, verticalCm),
    blockingReachCm: blockingReach(heightCm, verticalCm, blockingCoef),
    blockingCoef,
  };
}

/** Experience bonus lookup from 2d8 roll total */
export function experienceFromRoll(roll: number): ExperienceResult {
  if (roll <= 3)  return { roll, bonus: 0, label: 'No Experience' };
  if (roll <= 7)  return { roll, bonus: 1, label: 'Recreational Player' };
  if (roll <= 11) return { roll, bonus: 2, label: 'Middle School Team' };
  if (roll <= 15) return { roll, bonus: 3, label: 'Middle School Starter' };
  return { roll, bonus: 4, label: 'Middle School Contender' };
}

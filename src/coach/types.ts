// ─────────────────────────────────────────────────────────────────────────────
// Coach / Team Management — domain types
// A coach organises up to 12 imported Characters into a roster (jersey number +
// position) and a single starting lineup (6 rotation slots + libero).
// ─────────────────────────────────────────────────────────────────────────────

import type { Character } from '../types';

/** Volleyball position. Stored as the abbreviation; full name is for tooltips. */
export type Position = 'WS' | 'OP' | 'S' | 'MB' | 'Li';

export const POSITIONS: { abbr: Position; full: string }[] = [
  { abbr: 'WS', full: 'Wing Spiker' },
  { abbr: 'OP', full: 'Opposite Hitter' },
  { abbr: 'S', full: 'Setter' },
  { abbr: 'MB', full: 'Middle Blocker' },
  { abbr: 'Li', full: 'Libero' },
];

export const POSITION_FULL: Record<Position, string> = {
  WS: 'Wing Spiker',
  OP: 'Opposite Hitter',
  S: 'Setter',
  MB: 'Middle Blocker',
  Li: 'Libero',
};

export const MAX_ROSTER = 12;

/** One roster entry: a fully imported character plus coach-assigned metadata. */
export interface RosterPlayer {
  /** Stable id for this roster slot (lineup placement references this). */
  id: string;
  /** The full imported character — embedded so a coach file is self-contained. */
  character: Character;
  /** Jersey number 0–99, or null until assigned. */
  number: number | null;
  /** Position abbreviation, or null until assigned. */
  position: Position | null;
}

/** The six rotation slots, matching the line-up sheet (I = service). */
export type CourtSlot = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

export const COURT_SLOTS: CourtSlot[] = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/**
 * Visual layout of the line-up sheet (mirrors the printed sheet):
 *   IV  III  II
 *   V   VI   I
 * I is the service slot (bottom-right).
 */
export const COURT_LAYOUT: CourtSlot[][] = [
  ['IV', 'III', 'II'],
  ['V', 'VI', 'I'],
];

/** A single starting lineup: 6 court slots + 1 libero. Values are RosterPlayer ids. */
export interface Lineup {
  slots: Record<CourtSlot, string | null>;
  libero: string | null;
}

export interface CoachState {
  teamName: string;
  roster: RosterPlayer[];
  lineup: Lineup;
}

export function emptyLineup(): Lineup {
  return {
    slots: { I: null, II: null, III: null, IV: null, V: null, VI: null },
    libero: null,
  };
}

export function emptyCoachState(): CoachState {
  return { teamName: '', roster: [], lineup: emptyLineup() };
}

/** A placement target within the lineup. */
export type LineupTarget = { kind: 'slot'; slot: CourtSlot } | { kind: 'libero' };

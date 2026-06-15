// ─────────────────────────────────────────────────────────────────────────────
// Coach store — React context + reducer + debounced autosave.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { Character } from '../types';
import { generateUid } from '../state/characterStore';
import {
  type CoachState,
  type Lineup,
  type LineupTarget,
  type Position,
  type RosterPlayer,
  type CourtSlot,
  emptyCoachState,
  MAX_ROSTER,
} from './types';
import { autosaveCoach, loadCoach } from './persistence';

// ── Actions ────────────────────────────────────────────────────────────────────

export type CoachAction =
  | { type: 'SET_TEAM_NAME'; name: string }
  | { type: 'ADD_PLAYERS'; characters: Character[] }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'SET_NUMBER'; id: string; number: number | null }
  | { type: 'SET_POSITION'; id: string; position: Position | null }
  | { type: 'PLACE'; playerId: string; target: LineupTarget }
  | { type: 'CLEAR_TARGET'; target: LineupTarget }
  | { type: 'IMPORT_COACH'; coach: CoachState }
  | { type: 'RESET' };

// ── Lineup placement helpers ─────────────────────────────────────────────────

function valueAt(lineup: Lineup, target: LineupTarget): string | null {
  return target.kind === 'libero' ? lineup.libero : lineup.slots[target.slot];
}

function setAt(lineup: Lineup, target: LineupTarget, value: string | null): void {
  if (target.kind === 'libero') lineup.libero = value;
  else lineup.slots[target.slot] = value;
}

function locationOf(lineup: Lineup, playerId: string): LineupTarget | null {
  if (lineup.libero === playerId) return { kind: 'libero' };
  for (const slot of Object.keys(lineup.slots) as CourtSlot[]) {
    if (lineup.slots[slot] === playerId) return { kind: 'slot', slot };
  }
  return null;
}

function sameTarget(a: LineupTarget, b: LineupTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'slot' && b.kind === 'slot') return a.slot === b.slot;
  return true; // both libero
}

/**
 * Place `playerId` into `target`. A player can only occupy one spot at a time.
 * - If the player was already placed elsewhere and the target is occupied → swap.
 * - If the player was already placed and the target is empty → move.
 * - If the player was on the bench and the target is occupied → the occupant is
 *   sent back to the bench (replace).
 */
function placePlayer(lineup: Lineup, playerId: string, target: LineupTarget): Lineup {
  const from = locationOf(lineup, playerId);
  if (from && sameTarget(from, target)) return lineup; // no-op

  const next: Lineup = { slots: { ...lineup.slots }, libero: lineup.libero };
  const occupant = valueAt(next, target);

  setAt(next, target, playerId);
  if (from) {
    // swap occupant into the player's old spot (or clear it if target was empty)
    setAt(next, from, occupant && occupant !== playerId ? occupant : null);
  }
  return next;
}

function dropFromLineup(lineup: Lineup, playerId: string): Lineup {
  const loc = locationOf(lineup, playerId);
  if (!loc) return lineup;
  const next: Lineup = { slots: { ...lineup.slots }, libero: lineup.libero };
  setAt(next, loc, null);
  return next;
}

// ── Reducer ─────────────────────────────────────────────────────────────────

export function coachReducer(state: CoachState, action: CoachAction): CoachState {
  switch (action.type) {
    case 'SET_TEAM_NAME':
      return { ...state, teamName: action.name };

    case 'ADD_PLAYERS': {
      const room = MAX_ROSTER - state.roster.length;
      if (room <= 0) return state;
      const additions: RosterPlayer[] = action.characters.slice(0, room).map((character) => ({
        id: generateUid(),
        character,
        number: null,
        position: null,
      }));
      if (additions.length === 0) return state;
      return { ...state, roster: [...state.roster, ...additions] };
    }

    case 'REMOVE_PLAYER':
      return {
        ...state,
        roster: state.roster.filter((p) => p.id !== action.id),
        lineup: dropFromLineup(state.lineup, action.id),
      };

    case 'SET_NUMBER':
      return {
        ...state,
        roster: state.roster.map((p) => (p.id === action.id ? { ...p, number: action.number } : p)),
      };

    case 'SET_POSITION':
      return {
        ...state,
        roster: state.roster.map((p) => (p.id === action.id ? { ...p, position: action.position } : p)),
      };

    case 'PLACE':
      // ignore placement of unknown players (e.g. stale drag)
      if (!state.roster.some((p) => p.id === action.playerId)) return state;
      return { ...state, lineup: placePlayer(state.lineup, action.playerId, action.target) };

    case 'CLEAR_TARGET': {
      const occupant = valueAt(state.lineup, action.target);
      if (!occupant) return state;
      return { ...state, lineup: dropFromLineup(state.lineup, occupant) };
    }

    case 'IMPORT_COACH':
      return action.coach;

    case 'RESET':
      return emptyCoachState();

    default:
      return state;
  }
}

// ── Context / provider ────────────────────────────────────────────────────────

interface CoachContextValue {
  coach: CoachState;
  dispatch: React.Dispatch<CoachAction>;
}

const CoachContext = createContext<CoachContextValue | null>(null);

function initCoach(): CoachState {
  return loadCoach() ?? emptyCoachState();
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const [coach, dispatch] = useReducer(coachReducer, undefined, initCoach);

  useEffect(() => {
    autosaveCoach(coach);
  }, [coach]);

  return <CoachContext.Provider value={{ coach, dispatch }}>{children}</CoachContext.Provider>;
}

export function useCoach(): CoachContextValue {
  const ctx = useContext(CoachContext);
  if (!ctx) throw new Error('useCoach must be used within a CoachProvider');
  return ctx;
}

// ── Derived selectors ─────────────────────────────────────────────────────────

/** Roster players not currently placed in the lineup (the bench). */
export function benchPlayers(coach: CoachState): RosterPlayer[] {
  const placed = new Set<string>(
    [coach.lineup.libero, ...Object.values(coach.lineup.slots)].filter(Boolean) as string[]
  );
  return coach.roster.filter((p) => !placed.has(p.id));
}

/** Map of jersey number → count, for duplicate detection. */
export function duplicateNumbers(coach: CoachState): Set<number> {
  const counts = new Map<number, number>();
  for (const p of coach.roster) {
    if (p.number === null) continue;
    counts.set(p.number, (counts.get(p.number) ?? 0) + 1);
  }
  const dups = new Set<number>();
  for (const [num, count] of counts) if (count > 1) dups.add(num);
  return dups;
}

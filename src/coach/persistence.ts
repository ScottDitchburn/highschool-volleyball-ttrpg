// ─────────────────────────────────────────────────────────────────────────────
// Coach persistence — localStorage autosave + self-contained JSON backup.
// Kept entirely separate from the single-character builder save so the two
// never clobber each other.
// ─────────────────────────────────────────────────────────────────────────────

import type { CoachState, RosterPlayer, Position, Lineup } from './types';
import { COURT_SLOTS, emptyLineup, emptyCoachState } from './types';
import { generateUid } from '../state/characterStore';

export const COACH_STORAGE_KEY = 'haikyu-gauntlet-coach-v1';

const SCHEMA_VERSION = 1;

interface CoachEnvelope {
  version: number;
  savedAt: string; // ISO 8601
  coach: CoachState;
}

// ── Autosave (debounced) ──────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function autosaveCoach(coach: CoachState, delayMs = 500): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const envelope: CoachEnvelope = {
        version: SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        coach,
      };
      localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // quota exceeded / unavailable — fail silently
    }
  }, delayMs);
}

export function loadCoach(): CoachState | null {
  try {
    const raw = localStorage.getItem(COACH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const coach = coachFromEnvelope(parsed);
    return coach;
  } catch {
    return null;
  }
}

export function clearCoach(): void {
  try {
    localStorage.removeItem(COACH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── JSON backup export ────────────────────────────────────────────────────────

export function exportCoach(coach: CoachState): { blob: Blob; filename: string } {
  const envelope: CoachEnvelope = {
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    coach,
  };
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const safeName = (coach.teamName || 'team').replace(/[^a-z0-9_-]/gi, '_');
  const filename = `${safeName}-coach.json`;
  return { blob, filename };
}

export function downloadCoach(coach: CoachState): void {
  const { blob, filename } = exportCoach(coach);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── JSON backup import ─────────────────────────────────────────────────────────

export async function importCoachFromFile(
  file: File
): Promise<{ ok: true; coach: CoachState } | { ok: false; error: string }> {
  try {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'File is not valid JSON.' };
    }
    const coach = coachFromEnvelope(parsed);
    if (!coach) {
      return {
        ok: false,
        error: 'File does not look like a Haikyū coach backup (missing version or coach fields).',
      };
    }
    return { ok: true, coach };
  } catch (err) {
    return { ok: false, error: `Unexpected error: ${String(err)}` };
  }
}

// ── Shape parsing / sanitisation ───────────────────────────────────────────────

const VALID_POSITIONS: Position[] = ['WS', 'OP', 'S', 'MB', 'Li'];

/**
 * Parse + sanitise an unknown envelope into a CoachState, or return null.
 * Tolerant: drops malformed roster entries rather than failing the whole import,
 * and rebuilds the lineup so it only ever references surviving roster ids.
 */
function coachFromEnvelope(parsed: unknown): CoachState | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const env = parsed as Record<string, unknown>;
  if (typeof env.version !== 'number' || env.version !== SCHEMA_VERSION) return null;
  if (typeof env.coach !== 'object' || env.coach === null) return null;

  const raw = env.coach as Record<string, unknown>;
  const out = emptyCoachState();
  out.teamName = typeof raw.teamName === 'string' ? raw.teamName : '';

  const rawRoster = Array.isArray(raw.roster) ? raw.roster : [];
  const roster: RosterPlayer[] = [];
  for (const entry of rawRoster) {
    const player = sanitisePlayer(entry);
    if (player) roster.push(player);
  }
  out.roster = roster.slice(0, 12);

  out.lineup = sanitiseLineup(raw.lineup, new Set(out.roster.map((p) => p.id)));
  return out;
}

function sanitisePlayer(entry: unknown): RosterPlayer | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.character !== 'object' || e.character === null) return null;

  const id = typeof e.id === 'string' && e.id ? e.id : generateUid();
  let number: number | null = null;
  if (typeof e.number === 'number' && Number.isInteger(e.number) && e.number >= 0 && e.number <= 99) {
    number = e.number;
  }
  let position: Position | null = null;
  if (typeof e.position === 'string' && VALID_POSITIONS.includes(e.position as Position)) {
    position = e.position as Position;
  }
  // Character is trusted as-is (it round-trips through the builder's own schema);
  // a malformed character will simply render with empty fields, not crash.
  return { id, character: e.character as RosterPlayer['character'], number, position };
}

function sanitiseLineup(raw: unknown, validIds: Set<string>): Lineup {
  const lineup = emptyLineup();
  if (typeof raw !== 'object' || raw === null) return lineup;
  const r = raw as Record<string, unknown>;
  const slots = (typeof r.slots === 'object' && r.slots !== null ? r.slots : {}) as Record<string, unknown>;
  for (const slot of COURT_SLOTS) {
    const v = slots[slot];
    if (typeof v === 'string' && validIds.has(v)) lineup.slots[slot] = v;
  }
  if (typeof r.libero === 'string' && validIds.has(r.libero)) lineup.libero = r.libero;
  return lineup;
}

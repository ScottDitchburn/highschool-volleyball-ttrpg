// ─────────────────────────────────────────────────────────────────────────────
// Persistence — localStorage autosave + JSON export/import
// ─────────────────────────────────────────────────────────────────────────────

import type { Character, SelectedAbility, LevelUpRecord } from '../types';
import { generateUid } from './characterStore';
import { INITIAL_CHARACTER } from './characterStore';

export const STORAGE_KEY = 'haikyu-gauntlet-character-v1';

// Current schema version — bump if breaking changes are made to Character shape
const SCHEMA_VERSION = 1;

interface PersistedEnvelope {
  version: number;
  savedAt: string; // ISO 8601
  character: Character;
}

// ── Migration helpers ────────────────────────────────────────────────────────

/**
 * Ensure every SelectedAbility entry has a uid.
 * Old saves (before the instance model) will lack uid; inject one so they don't crash.
 */
function migrateSelectedAbilities(abilities: unknown[]): SelectedAbility[] {
  return abilities.map((entry) => {
    const sel = entry as Record<string, unknown>;
    if (typeof sel.uid !== 'string' || sel.uid === '') {
      return { ...sel, uid: generateUid() } as unknown as SelectedAbility;
    }
    return sel as unknown as SelectedAbility;
  });
}

/**
 * The level-up record shape changed with the two-event (Summer/Spring Interhigh)
 * system. Old records lack a `season` field. Drop incompatible entries — the
 * character's banked AP lives in apBudget.levelUpGains and is preserved — so the
 * history footnote just starts fresh rather than rendering broken rows.
 */
function migrateLevelUpHistory(history: unknown): LevelUpRecord[] {
  if (!Array.isArray(history)) return [];
  return history.filter((entry): entry is LevelUpRecord => {
    const r = entry as Record<string, unknown> | null;
    return r != null && (r.season === 'summer' || r.season === 'spring');
  });
}

// ── Debounce helper ───────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced autosave to localStorage.
 * Writes at most once per 500 ms to avoid thrashing on rapid state changes.
 */
export function autosave(character: Character, delayMs = 500): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const envelope: PersistedEnvelope = {
        version: SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        character,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // localStorage quota exceeded or unavailable — fail silently
    }
  }, delayMs);
}

/**
 * Load character from localStorage.
 * Returns the saved Character on success, or null if nothing is saved / data is invalid.
 * This is called once on app boot, before the first render (inside the Provider).
 */
export function loadSaved(): Character | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) return null;
    if (parsed.version !== SCHEMA_VERSION) return null; // schema changed — discard
    if (!isCharacter(parsed.character)) return null;

    const character = parsed.character;
    // Migrate: inject uids for old saves that lack them
    if (Array.isArray(character.selectedAbilities)) {
      character.selectedAbilities = migrateSelectedAbilities(character.selectedAbilities);
    }
    // Migrate: drop pre-two-event level-up records (banked AP is preserved separately)
    character.levelUpHistory = migrateLevelUpHistory(character.levelUpHistory);
    return character;
  } catch {
    return null;
  }
}

/**
 * Clear the autosave slot (e.g. on RESET).
 */
export function clearSaved(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── JSON export ───────────────────────────────────────────────────────────────

/**
 * Serialise character to a pretty-printed JSON Blob.
 * Returns { blob, filename } ready for a download link.
 */
export function exportCharacter(character: Character): { blob: Blob; filename: string } {
  const envelope: PersistedEnvelope = {
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    character,
  };
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const safeName = (character.name || 'unnamed').replace(/[^a-z0-9_-]/gi, '_');
  const filename  = `${safeName}-haikyu.json`;
  return { blob, filename };
}

/**
 * Trigger a browser download of the character JSON.
 */
export function downloadCharacter(character: Character): void {
  const { blob, filename } = exportCharacter(character);
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── JSON import ───────────────────────────────────────────────────────────────

/**
 * Parse and validate an uploaded JSON file.
 *
 * Returns:
 *   { ok: true,  character } on success
 *   { ok: false, error }     on any failure (bad JSON, wrong shape, wrong version)
 *
 * Never throws.
 */
export async function importCharacterFromFile(
  file: File
): Promise<{ ok: true; character: Character } | { ok: false; error: string }> {
  try {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'File is not valid JSON.' };
    }

    if (!isEnvelope(parsed)) {
      return { ok: false, error: 'File does not look like a Haikyū character export (missing version or character fields).' };
    }

    if (parsed.version !== SCHEMA_VERSION) {
      return {
        ok: false,
        error: `Schema version mismatch: file is v${parsed.version}, app expects v${SCHEMA_VERSION}. Export the character again to upgrade.`,
      };
    }

    if (!isCharacter(parsed.character)) {
      return { ok: false, error: 'Character data is malformed or incomplete.' };
    }

    const character = parsed.character;
    // Migrate: inject uids for old saves that lack them
    if (Array.isArray(character.selectedAbilities)) {
      character.selectedAbilities = migrateSelectedAbilities(character.selectedAbilities);
    }
    // Migrate: drop pre-two-event level-up records (banked AP is preserved separately)
    character.levelUpHistory = migrateLevelUpHistory(character.levelUpHistory);
    return { ok: true, character };
  } catch (err) {
    return { ok: false, error: `Unexpected error: ${String(err)}` };
  }
}

// ── Shape guards ──────────────────────────────────────────────────────────────

function isEnvelope(v: unknown): v is PersistedEnvelope {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.version === 'number' &&
    typeof obj.character === 'object' &&
    obj.character !== null
  );
}

function isCharacter(v: unknown): v is Character {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  // Minimal required fields — enough to catch totally wrong files
  const required: (keyof Character)[] = [
    'name',
    'schoolYear',
    'physicalPool',
    'skillPool',
    'selectedAbilities',
    'levelUpHistory',
    'apBudget',
  ];
  for (const key of required) {
    if (!(key in obj)) return false;
  }
  // Merge missing keys with INITIAL_CHARACTER so old saves with new optional
  // fields don't break (forward-compat shim)
  mergeDefaults(obj, INITIAL_CHARACTER as unknown as Record<string, unknown>);
  return true;
}

/**
 * Mutates `target` to ensure every key in `defaults` is present.
 * Only adds keys that are entirely absent — does not overwrite existing data.
 */
function mergeDefaults(
  target: Record<string, unknown>,
  defaults: Record<string, unknown>
): void {
  for (const key of Object.keys(defaults)) {
    if (!(key in target)) {
      target[key] = defaults[key];
    }
  }
}

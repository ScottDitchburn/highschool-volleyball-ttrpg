// ─────────────────────────────────────────────────────────────────────────────
// Persistence — localStorage autosave + JSON export/import
// ─────────────────────────────────────────────────────────────────────────────

import type { Character, SelectedAbility, LevelUpRecord, PhysicalAttributes } from '../types';
import { computeReaches, makePhysicalAttributes } from '../types';
import { generateUid } from './characterStore';
import { INITIAL_CHARACTER } from './characterStore';

export const STORAGE_KEY = 'haikyu-gauntlet-character-v1';

// Current schema version — bump if breaking changes are made to Character shape.
//   v1 → v2: v.3 "Height – Vert Jump Modifier". `physical.verticalCm` is now
//            derived from the modified vertical roll and `physical.verticalModifier`
//            was added.
//   v2 → v3: the roll→cm conversions were corrected to match the printed
//            Physical Attributes Table (height 148 + 2×roll, vertical 39 + 3×roll;
//            they were 150 + 2×roll / 45 + 3×roll, i.e. +2 cm / +6 cm too high).
// Older saves are migrated, not discarded, on load/import.
export const SCHEMA_VERSION = 3;

/** Schema versions this build can read (older ones are upgraded by migration). */
const SUPPORTED_VERSIONS = [1, 2, 3];

/** True when this build knows how to read a save written at `version`. */
export function isSupportedVersion(version: number): boolean {
  return SUPPORTED_VERSIONS.includes(version);
}

/**
 * The buggy height conversion used by schema v1 and v2 saves. Needed to work out
 * how much of a stored `heightCm` was accrued Interhigh growth (which is banked
 * in cm and is not encoded in the roll) versus the base table lookup.
 */
function legacyHeightCm(roll: number): number {
  return 150 + 2 * roll;
}

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

/**
 * Physical-attribute migration for older saves.
 *
 *  - v1/v2 → v3: both roll→cm conversions were off from the printed Physical
 *    Attributes Table (height +2 cm, vertical +6 cm). Recompute both columns
 *    from the stored rolls.
 *  - v1 → v2: `verticalCm` used the RAW vertical roll and `verticalModifier` did
 *    not exist. Recompute from the rolls via the v.3 modifier.
 *
 * Interhigh height growth is banked in cm and is not encoded in the height roll,
 * so it is measured against the schema version's own base conversion and carried
 * across to the corrected base height.
 *
 * Idempotent: a current-schema physical block recomputes to the same numbers.
 */
export function migratePhysical(character: Character, version: number = SCHEMA_VERSION): Character {
  const physical = character.physical as PhysicalAttributes | null;
  if (!physical || typeof physical.heightRoll !== 'number' || typeof physical.verticalRoll !== 'number') {
    return character;
  }
  const fresh = makePhysicalAttributes(physical.heightRoll, physical.verticalRoll);

  // Separate banked level-up growth (cm) from the base table height, using the
  // conversion that was in force when the save was written.
  const baseAtSaveTime = version <= 2 ? legacyHeightCm(physical.heightRoll) : fresh.heightCm;
  const growthCm = typeof physical.heightCm === 'number'
    ? Math.round((physical.heightCm - baseAtSaveTime) * 10) / 10  // growth is 1d20 × 0.1 cm
    : 0;

  const migrated: PhysicalAttributes = {
    ...physical,
    heightCm: Math.round((fresh.heightCm + growthCm) * 10) / 10,
    verticalModifier: fresh.verticalModifier,
    verticalCm: fresh.verticalCm,
  };
  if (migrated.heightCm === physical.heightCm &&
      migrated.verticalCm === physical.verticalCm &&
      migrated.verticalModifier === physical.verticalModifier) {
    return character;
  }
  character.physical = migrated;
  character.reaches = computeReaches(
    migrated.heightCm,
    migrated.verticalCm,
    character.reaches?.blockingCoef ?? 0.85,
  );
  return character;
}

/**
 * Single migration path for any character payload that did not come from the
 * running session: JSON import, and cloud loads.
 *
 * Validates the shape, upgrades old schema versions in place and hands back a
 * ready-to-dispatch Character. Never throws.
 */
export function adoptCharacter(
  raw: unknown,
  version: number,
  source = 'data',
): { ok: true; character: Character } | { ok: false; error: string } {
  if (!isSupportedVersion(version)) {
    return {
      ok: false,
      error: `Schema version mismatch: ${source} is v${version}, app expects v${SCHEMA_VERSION}. Export the character again to upgrade.`,
    };
  }
  if (!isCharacter(raw)) {
    return { ok: false, error: 'Character data is malformed or incomplete.' };
  }

  const character = raw;
  // Migrate: inject uids for old saves that lack them
  if (Array.isArray(character.selectedAbilities)) {
    character.selectedAbilities = migrateSelectedAbilities(character.selectedAbilities);
  }
  // Migrate: drop pre-two-event level-up records (banked AP is preserved separately)
  character.levelUpHistory = migrateLevelUpHistory(character.levelUpHistory);
  // Migrate: v.3 modifier + corrected roll→cm table conversions
  return { ok: true, character: migratePhysical(character, version) };
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
    if (!SUPPORTED_VERSIONS.includes(parsed.version)) return null; // unknown schema — discard
    if (!isCharacter(parsed.character)) return null;

    const character = parsed.character;
    // Migrate: inject uids for old saves that lack them
    if (Array.isArray(character.selectedAbilities)) {
      character.selectedAbilities = migrateSelectedAbilities(character.selectedAbilities);
    }
    // Migrate: drop pre-two-event level-up records (banked AP is preserved separately)
    character.levelUpHistory = migrateLevelUpHistory(character.levelUpHistory);
    // Migrate: v.3 modifier + corrected roll→cm table conversions
    return migratePhysical(character, parsed.version);
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

    return adoptCharacter(parsed.character, parsed.version, 'file');
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

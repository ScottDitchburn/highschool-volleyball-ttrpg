// ─────────────────────────────────────────────────────────────────────────────
// Bulk upload — turn a pile of old JSON files into cloud rows.
//
// Accepted file shapes (any mix, one file may hold several characters):
//   • a builder export         { version, savedAt, character }
//   • a coach backup           { version, coach: { roster: [{ character }] } }
//   • a bare character object  { name, schoolYear, selectedAbilities, … }
//   • a JSON array of any of the above
//
// Every character passes through adoptCharacter(), so the same migrations the
// single-file import applies run here, and any `cloudId` bookmark is dropped:
// each upload always creates a fresh row for the signed-in user.
// ─────────────────────────────────────────────────────────────────────────────

import type { Character } from '../types';
import { adoptCharacter, SCHEMA_VERSION } from '../state/persistence';
import { save } from './characters';
import type { CloudClient } from './types';

export interface BulkItem {
  /** Where the character came from, e.g. "team.json (player 3)". */
  source: string;
  name: string;
  character: Character;
}

export interface BulkParseResult {
  items: BulkItem[];
  /** One message per thing that could not be read, prefixed with its source. */
  errors: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function displayName(character: Character): string {
  return character.name.trim() || 'Unnamed Player';
}

/** Adopt one raw character, stripping the cloud bookmark so it inserts anew. */
function adopt(raw: unknown, version: number, source: string, out: BulkParseResult): void {
  const result = adoptCharacter(raw, version, source);
  if (!result.ok) {
    out.errors.push(`${source}: ${result.error}`);
    return;
  }
  const character = { ...result.character };
  delete character.cloudId;
  out.items.push({ source, name: displayName(character), character });
}

function collect(value: unknown, source: string, out: BulkParseResult): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.errors.push(`${source}: the file holds an empty list.`);
      return;
    }
    value.forEach((entry, i) => collect(entry, `${source} [${i + 1}]`, out));
    return;
  }
  if (!isRecord(value)) {
    out.errors.push(`${source}: not a character file.`);
    return;
  }

  // Builder export envelope.
  if (typeof value.version === 'number' && isRecord(value.character)) {
    adopt(value.character, value.version, source, out);
    return;
  }

  // Coach backup: every roster entry that carries a character.
  if (isRecord(value.coach)) {
    const roster = Array.isArray(value.coach.roster) ? value.coach.roster : [];
    const players = roster.filter((p): p is Record<string, unknown> => isRecord(p) && isRecord(p.character));
    if (players.length === 0) {
      out.errors.push(`${source}: the coach backup has no players.`);
      return;
    }
    // Coach backups do not record the character schema; the coach screen reads
    // them as current, so the bulk upload does the same.
    players.forEach((p, i) => adopt(p.character, SCHEMA_VERSION, `${source} (player ${i + 1})`, out));
    return;
  }

  // Bare character object (no envelope): treated as the current schema.
  if ('selectedAbilities' in value && 'schoolYear' in value) {
    adopt(value, SCHEMA_VERSION, source, out);
    return;
  }

  out.errors.push(`${source}: not a character export, coach backup or character object.`);
}

/** Pure: read one file's text into zero or more uploadable characters. */
export function parseBulkText(text: string, fileName: string): BulkParseResult {
  const out: BulkParseResult = { items: [], errors: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    out.errors.push(`${fileName}: not valid JSON.`);
    return out;
  }
  collect(parsed, fileName, out);
  return out;
}

/** Blob.text() where available, else FileReader (older browsers, jsdom). */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Read and parse every chosen file; results keep the files' order. */
export async function parseBulkFiles(files: Iterable<File>): Promise<BulkParseResult> {
  const out: BulkParseResult = { items: [], errors: [] };
  for (const file of files) {
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      out.errors.push(`${file.name}: could not be read.`);
      continue;
    }
    const one = parseBulkText(text, file.name);
    out.items.push(...one.items);
    out.errors.push(...one.errors);
  }
  return out;
}

export interface BulkUploadOutcome {
  item: BulkItem;
  ok: boolean;
  error?: string;
}

/**
 * Save each character as a new private row for `userId`, one at a time so a
 * large batch neither floods the API nor loses everything on one failure.
 * `onProgress` fires after every attempt with the count completed so far.
 */
export async function bulkUpload(
  client: CloudClient,
  userId: string,
  items: readonly BulkItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkUploadOutcome[]> {
  const outcomes: BulkUploadOutcome[] = [];
  for (const item of items) {
    const result = await save(client, item.character, userId);
    outcomes.push(result.ok ? { item, ok: true } : { item, ok: false, error: result.error });
    onProgress?.(outcomes.length, items.length);
  }
  return outcomes;
}

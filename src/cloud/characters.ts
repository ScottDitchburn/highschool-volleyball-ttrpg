// ─────────────────────────────────────────────────────────────────────────────
// Cloud characters repository.
//
// Pure functions over a `CloudClient` (see types.ts) — the client is always a
// parameter, never a module singleton, so tests hand in a fake and nothing
// touches the network. Every function returns a CloudOutcome instead of
// throwing, so the UI can render errors inline.
// ─────────────────────────────────────────────────────────────────────────────

import type { Character } from '../types';
import { SCHEMA_VERSION, adoptCharacter } from '../state/persistence';
import { computeEffectiveStats } from '../state/characterStore';
import type { SkillStats, CharacterProfile } from '../types';
import { positionCodes } from '../types';
import { traitLabel } from '../data/traits';
import type {
  CloudCharacterRow,
  CloudCharacterSummary,
  CloudClient,
  CloudOutcome,
  CloudProfile,
  CloudResult,
} from './types';

/** Owned rows (RLS-scoped to the caller). */
export const CHARACTERS_TABLE = 'characters';
/** Public browse view — readable by anon, joins the owner's username. */
export const PUBLIC_CHARACTERS_VIEW = 'public_characters';
const PROFILES_TABLE = 'profiles';

/** How many public characters the browse panel pulls at once. */
export const PUBLIC_PAGE_SIZE = 50;

// ── helpers ──────────────────────────────────────────────────────────────────

function fail<T>(error: string): CloudOutcome<T> {
  return { ok: false, error };
}

function describe(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim() !== '') return message;
  }
  return fallback;
}

/** Await a query and normalise whatever blew up into a CloudOutcome. */
async function run<T>(
  query: PromiseLike<CloudResult<T>>,
  fallback: string,
): Promise<CloudOutcome<T | null>> {
  try {
    const { data, error } = await query;
    if (error) return fail(describe(error, fallback));
    return { ok: true, value: data };
  } catch (err) {
    return fail(describe(err, fallback));
  }
}

/** The character payload of a row, when it looks like an object at all. */
function payloadOf(row: CloudCharacterRow): Record<string, unknown> | null {
  const data = row.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function numberAt(obj: unknown, key: string): number | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Effective stats of a stored payload, computed exactly as the builder does
 * (migration + ability effects). Null when the payload is not a usable
 * character or its skills are unassigned.
 */
function effectiveStatsOf(row: CloudCharacterRow, payload: Record<string, unknown>): SkillStats | null {
  const version = typeof row.schema_version === 'number' ? row.schema_version : SCHEMA_VERSION;
  try {
    const adopted = adoptCharacter(JSON.parse(JSON.stringify(payload)) as unknown, version, 'row');
    return adopted.ok ? computeEffectiveStats(adopted.character) : null;
  } catch {
    return null;
  }
}

export function toSummary(row: CloudCharacterRow): CloudCharacterSummary {
  const payload = payloadOf(row);
  const year = payload && typeof payload.schoolYear === 'number' ? payload.schoolYear : null;
  const physical = payload?.physical ?? null;
  const abilities = payload?.selectedAbilities;
  const abilityIds = Array.isArray(abilities)
    ? abilities
        .map((a) => (typeof a === 'object' && a !== null ? (a as Record<string, unknown>).abilityId : null))
        .filter((id): id is string => typeof id === 'string')
    : [];
  return {
    id: row.id,
    name: row.name || 'Unnamed Player',
    isPublic: row.is_public === true,
    updatedAt: row.updated_at ?? row.created_at ?? null,
    schoolYear: year,
    graduated: payload?.graduated === true,
    ownerUsername: row.owner_username ?? null,
    ownerId: row.owner_id ?? null,
    heightCm: numberAt(physical, 'heightCm'),
    verticalCm: numberAt(physical, 'verticalCm'),
    abilityCount: Array.isArray(abilities) ? abilities.length : 0,
    abilityIds,
    stats: payload ? effectiveStatsOf(row, payload) : null,
    traits: profileTraits(payload),
    positions: profilePositions(payload),
  };
}

function profileOfPayload(payload: Record<string, unknown> | null): Partial<CharacterProfile> | null {
  const p = payload?.profile;
  return typeof p === 'object' && p !== null ? (p as Partial<CharacterProfile>) : null;
}

function profileTraits(payload: Record<string, unknown> | null): string[] {
  const traits = profileOfPayload(payload)?.traits;
  if (!Array.isArray(traits)) return [];
  return traits.map((t) => (typeof t === 'string' ? traitLabel(t) : '')).filter(Boolean);
}

function profilePositions(payload: Record<string, unknown> | null): string {
  const positions = profileOfPayload(payload)?.positions;
  if (typeof positions !== 'object' || positions === null) return '';
  return positionCodes(positions as CharacterProfile['positions']);
}

// ── reads ────────────────────────────────────────────────────────────────────

/** Every character belonging to `ownerId`, newest first. */
export async function listMine(
  client: CloudClient,
  ownerId: string,
): Promise<CloudOutcome<CloudCharacterSummary[]>> {
  const result = await run(
    client
      .from<CloudCharacterRow>(CHARACTERS_TABLE)
      .select('id, owner_id, name, is_public, schema_version, data, created_at, updated_at')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false }),
    'Could not load your cloud characters.',
  );
  if (!result.ok) return result;
  return { ok: true, value: (result.value ?? []).map(toSummary) };
}

/** Every character flagged public, newest first — works signed out too. */
export async function listPublic(
  client: CloudClient,
  limit = PUBLIC_PAGE_SIZE,
): Promise<CloudOutcome<CloudCharacterSummary[]>> {
  const result = await run(
    client
      .from<CloudCharacterRow>(PUBLIC_CHARACTERS_VIEW)
      .select('id, owner_id, name, owner_username, schema_version, data, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit),
    'Could not load public characters.',
  );
  if (!result.ok) return result;
  // The view only ever contains public rows; the column is not selected.
  return { ok: true, value: (result.value ?? []).map((row) => ({ ...toSummary(row), isPublic: true })) };
}

/**
 * Load one character by row id and run it through the same migration path as a
 * JSON import, so old cloud saves are upgraded on the way in.
 *
 * Tries the owner-scoped table first and falls back to the public view, which
 * is what a signed-out visitor (or anyone opening someone else's character)
 * hits. `cloudId` is kept only when the row is the caller's own — otherwise it
 * is stripped so the next save creates a copy of their own.
 */
export async function load(
  client: CloudClient,
  id: string,
  viewerId?: string | null,
): Promise<CloudOutcome<Character>> {
  let row: CloudCharacterRow | null = null;

  const mine = await run(
    client.from<CloudCharacterRow>(CHARACTERS_TABLE).select('*').eq('id', id).maybeSingle(),
    'Could not load that character.',
  );
  if (mine.ok) row = mine.value;

  if (!row) {
    const shared = await run(
      client.from<CloudCharacterRow>(PUBLIC_CHARACTERS_VIEW).select('*').eq('id', id).maybeSingle(),
      'Could not load that character.',
    );
    if (!shared.ok) return fail(shared.error);
    row = shared.value;
  }

  if (!row) return fail('That character is no longer available.');

  const payload = payloadOf(row);
  if (!payload) return fail('Character data is malformed or incomplete.');

  const version = typeof row.schema_version === 'number' ? row.schema_version : SCHEMA_VERSION;
  // Work on a copy: the migration mutates the payload in place.
  const adopted = adoptCharacter(
    JSON.parse(JSON.stringify(payload)) as unknown,
    version,
    'this cloud save',
  );
  if (!adopted.ok) return fail(adopted.error);

  const character = adopted.character;
  const isMine = viewerId != null && row.owner_id === viewerId;
  if (isMine) {
    character.cloudId = row.id;
  } else {
    // Someone else's character (or an anonymous viewer): saving must create a
    // fresh row of the viewer's own rather than overwrite the original.
    delete character.cloudId;
  }
  return { ok: true, value: character };
}

/** The signed-in user's Discord display info, or null when there is no row yet. */
export async function loadProfile(
  client: CloudClient,
  userId: string,
): Promise<CloudOutcome<CloudProfile | null>> {
  const result = await run(
    client
      .from<{ id: string; username: string | null; avatar_url: string | null }>(PROFILES_TABLE)
      .select('id, username, avatar_url')
      .eq('id', userId)
      .maybeSingle(),
    'Could not load your profile.',
  );
  if (!result.ok) return result;
  const row = result.value;
  if (!row) return { ok: true, value: null };
  return {
    ok: true,
    value: { id: row.id, username: row.username ?? null, avatarUrl: row.avatar_url ?? null },
  };
}

// ── writes ───────────────────────────────────────────────────────────────────

/**
 * Insert (no `cloudId` yet) or update (has one) the character for `ownerId`.
 * Returns the row id, which the caller stores back on the character.
 */
export async function save(
  client: CloudClient,
  character: Character,
  ownerId: string,
): Promise<CloudOutcome<string>> {
  const name = character.name.trim() || 'Unnamed Player';
  // cloudId is a client-side bookmark; it never belongs inside the payload.
  const payload: Record<string, unknown> = { ...character };
  delete payload.cloudId;

  const existingId = character.cloudId;

  const query = existingId
    ? client
        .from<CloudCharacterRow>(CHARACTERS_TABLE)
        .update({ name, schema_version: SCHEMA_VERSION, data: payload })
        .eq('id', existingId)
        .eq('owner_id', ownerId)
        .select('id')
        .single()
    : client
        .from<CloudCharacterRow>(CHARACTERS_TABLE)
        .insert({
          owner_id: ownerId,
          name,
          schema_version: SCHEMA_VERSION,
          data: payload,
          is_public: false,
        })
        .select('id')
        .single();

  const result = await run(query, 'Could not save to the cloud.');
  if (!result.ok) return result;
  const id = result.value?.id ?? existingId;
  if (!id) return fail('The cloud did not return a character id.');
  return { ok: true, value: id };
}

/** Delete one of the caller's characters. RLS keeps this to your own rows. */
export async function remove(client: CloudClient, id: string): Promise<CloudOutcome<true>> {
  const result = await run(
    client.from<CloudCharacterRow>(CHARACTERS_TABLE).delete().eq('id', id),
    'Could not delete that character.',
  );
  if (!result.ok) return result;
  return { ok: true, value: true };
}

/** Whether one of the caller's characters is currently public (null if not found). */
export async function getPublic(client: CloudClient, id: string): Promise<CloudOutcome<boolean | null>> {
  const result = await run(
    client.from<CloudCharacterRow>(CHARACTERS_TABLE).select('id, is_public').eq('id', id).maybeSingle(),
    'Could not read who can see that character.',
  );
  if (!result.ok) return result;
  return { ok: true, value: result.value ? result.value.is_public === true : null };
}

/** Flip the per-character public flag. */
export async function setPublic(
  client: CloudClient,
  id: string,
  isPublic: boolean,
): Promise<CloudOutcome<boolean>> {
  const result = await run(
    client.from<CloudCharacterRow>(CHARACTERS_TABLE).update({ is_public: isPublic }).eq('id', id),
    'Could not change who can see that character.',
  );
  if (!result.ok) return result;
  return { ok: true, value: isPublic };
}

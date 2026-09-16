// src/__tests__/cloudCharacters.test.ts
// Cloud repository functions against a hand-rolled fake client — no network.
import { describe, it, expect } from 'vitest';
import {
  CHARACTERS_TABLE,
  PUBLIC_CHARACTERS_VIEW,
  listMine,
  listPublic,
  load,
  remove,
  save,
  setPublic,
} from '../cloud/characters';
import { SCHEMA_VERSION } from '../state/persistence';
import { INITIAL_CHARACTER } from '../state/characterStore';
import { makePhysicalAttributes, type Character } from '../types';
import { makeFakeDb, type FakeCall } from './helpers/fakeCloudClient';
import type { CloudResult } from '../cloud/types';

const OWNER = 'user-1';

function baseCharacter(overrides: Partial<Character> = {}): Character {
  return { ...INITIAL_CHARACTER, name: 'Hinata', ...overrides };
}

function ok(data: unknown): CloudResult<unknown> {
  return { data, error: null };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    owner_id: OWNER,
    name: 'Hinata',
    is_public: false,
    schema_version: SCHEMA_VERSION,
    data: baseCharacter(),
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-02-02T00:00:00.000Z',
    ...overrides,
  };
}

function filterValue(call: FakeCall, column: string): unknown {
  return call.filters.find((f) => f.column === column)?.value;
}

describe('save()', () => {
  it('inserts when the character has no cloud id', async () => {
    const db = makeFakeDb((call) => (call.op === 'insert' ? ok({ id: 'new-row' }) : ok(null)));

    const result = await save(db.client, baseCharacter(), OWNER);

    expect(result).toEqual({ ok: true, value: 'new-row' });
    const call = db.calls[0];
    expect(call.table).toBe(CHARACTERS_TABLE);
    expect(call.op).toBe('insert');
    expect(call.values?.owner_id).toBe(OWNER);
    expect(call.values?.name).toBe('Hinata');
    expect(call.values?.schema_version).toBe(SCHEMA_VERSION);
    expect(call.values?.is_public).toBe(false);
    expect(call.single).toBe(true);
  });

  it('updates in place when the character already has a cloud id', async () => {
    const db = makeFakeDb((call) => (call.op === 'update' ? ok({ id: 'row-1' }) : ok(null)));

    const result = await save(db.client, baseCharacter({ cloudId: 'row-1' }), OWNER);

    expect(result).toEqual({ ok: true, value: 'row-1' });
    const call = db.calls[0];
    expect(call.op).toBe('update');
    expect(filterValue(call, 'id')).toBe('row-1');
    // owner_id is pinned on the update too, belt-and-braces with the RLS policy.
    expect(filterValue(call, 'owner_id')).toBe(OWNER);
    expect(call.values?.owner_id).toBeUndefined();
  });

  it('never writes the client-side cloudId bookmark into the payload', async () => {
    const db = makeFakeDb((call) => (call.op === 'update' ? ok({ id: 'row-1' }) : ok(null)));

    await save(db.client, baseCharacter({ cloudId: 'row-1' }), OWNER);

    const payload = db.calls[0].values?.data as Record<string, unknown>;
    expect('cloudId' in payload).toBe(false);
    expect(payload.name).toBe('Hinata');
  });

  it('reports the database error instead of throwing', async () => {
    const db = makeFakeDb(() => ({ data: null, error: { message: 'row level security' } }));

    const result = await save(db.client, baseCharacter(), OWNER);

    expect(result).toEqual({ ok: false, error: 'row level security' });
  });
});

describe('listMine()', () => {
  it('filters to the caller and maps rows to summaries', async () => {
    const db = makeFakeDb(() =>
      ok([
        row({ id: 'a', name: 'Kageyama', is_public: true, data: baseCharacter({ schoolYear: 2 }) }),
        row({ id: 'b', name: 'Tsukishima', data: baseCharacter({ graduated: true }) }),
      ]),
    );

    const result = await listMine(db.client, OWNER);

    expect(result.ok).toBe(true);
    const call = db.calls[0];
    expect(call.table).toBe(CHARACTERS_TABLE);
    expect(filterValue(call, 'owner_id')).toBe(OWNER);
    expect(call.order).toEqual({ column: 'updated_at', ascending: false });
    if (!result.ok) return;
    expect(result.value.map((r) => r.name)).toEqual(['Kageyama', 'Tsukishima']);
    expect(result.value[0].isPublic).toBe(true);
    expect(result.value[0].schoolYear).toBe(2);
    expect(result.value[1].graduated).toBe(true);
  });

  it('turns an error into a failed outcome', async () => {
    const db = makeFakeDb(() => ({ data: null, error: { message: 'offline' } }));
    const result = await listMine(db.client, OWNER);
    expect(result).toEqual({ ok: false, error: 'offline' });
  });
});

describe('listPublic()', () => {
  it('reads the public view and keeps the owner username', async () => {
    const db = makeFakeDb(() =>
      ok([row({ id: 'p1', owner_id: 'someone-else', owner_username: 'karasuno_fan' })]),
    );

    const result = await listPublic(db.client);

    expect(db.calls[0].table).toBe(PUBLIC_CHARACTERS_VIEW);
    expect(db.calls[0].limit).toBe(50);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0].ownerUsername).toBe('karasuno_fan');
    expect(result.value[0].isPublic).toBe(true);
  });
});

describe('load()', () => {
  it('migrates an old schema version through the same path as JSON import', async () => {
    // v1 save: buggy height conversion (150 + 2×roll) and a vertical jump taken
    // from the RAW roll, with no verticalModifier field at all.
    const legacy = {
      ...baseCharacter(),
      physical: {
        heightRoll: 20,
        verticalRoll: 15,
        heightCm: 190,
        verticalCm: 90,
      },
    };
    const db = makeFakeDb(() => ok(row({ schema_version: 1, data: legacy })));

    const result = await load(db.client, 'row-1', OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fresh = makePhysicalAttributes(20, 15);
    expect(result.value.physical?.heightCm).toBe(fresh.heightCm);        // 188, not 190
    expect(result.value.physical?.verticalCm).toBe(fresh.verticalCm);    // modifier applied
    expect(result.value.physical?.verticalModifier).toBe(fresh.verticalModifier);
  });

  it('keeps cloudId when the row belongs to the viewer', async () => {
    const db = makeFakeDb(() => ok(row()));
    const result = await load(db.client, 'row-1', OWNER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cloudId).toBe('row-1');
  });

  it("strips cloudId from someone else's public character", async () => {
    const db = makeFakeDb((call) =>
      call.table === CHARACTERS_TABLE
        ? ok(null) // RLS: another player's private row is simply not visible
        : ok(
            row({
              owner_id: 'someone-else',
              owner_username: 'oikawa',
              // a stale bookmark left in the payload must not survive either
              data: { ...baseCharacter(), cloudId: 'row-1' },
            }),
          ),
    );

    const result = await load(db.client, 'row-1', OWNER);

    expect(db.calls.map((c) => c.table)).toEqual([CHARACTERS_TABLE, PUBLIC_CHARACTERS_VIEW]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cloudId).toBeUndefined();
    expect(result.value.name).toBe('Hinata');
  });

  it('strips cloudId for a signed-out viewer', async () => {
    const db = makeFakeDb((call) =>
      call.table === CHARACTERS_TABLE ? ok(null) : ok(row({ owner_id: 'someone-else' })),
    );

    const result = await load(db.client, 'row-1', null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cloudId).toBeUndefined();
  });

  it('fails cleanly when the row is gone', async () => {
    const db = makeFakeDb(() => ok(null));
    const result = await load(db.client, 'missing', OWNER);
    expect(result).toEqual({ ok: false, error: 'That character is no longer available.' });
  });

  it('fails cleanly when the payload is not a character', async () => {
    const db = makeFakeDb(() => ok(row({ data: { nonsense: true } })));
    const result = await load(db.client, 'row-1', OWNER);
    expect(result.ok).toBe(false);
  });
});

describe('remove() / setPublic()', () => {
  it('deletes by id', async () => {
    const db = makeFakeDb(() => ok(null));
    const result = await remove(db.client, 'row-1');
    expect(result).toEqual({ ok: true, value: true });
    expect(db.calls[0].op).toBe('delete');
    expect(filterValue(db.calls[0], 'id')).toBe('row-1');
  });

  it('flips the public flag', async () => {
    const db = makeFakeDb(() => ok(null));
    const result = await setPublic(db.client, 'row-1', true);
    expect(result).toEqual({ ok: true, value: true });
    expect(db.calls[0].op).toBe('update');
    expect(db.calls[0].values).toEqual({ is_public: true });
    expect(filterValue(db.calls[0], 'id')).toBe('row-1');
  });
});

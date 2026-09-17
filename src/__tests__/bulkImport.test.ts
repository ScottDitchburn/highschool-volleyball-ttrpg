// Bulk upload: the pure parser accepts every file shape the app has ever
// written, migrates old saves, drops cloud bookmarks, and reports what it
// could not read; the uploader inserts one private row per character.
import { describe, it, expect } from 'vitest';
import { INITIAL_CHARACTER } from '../state/characterStore';
import { SCHEMA_VERSION } from '../state/persistence';
import { parseBulkText, bulkUpload } from '../cloud/bulkImport';
import { makeFakeDb } from './helpers/fakeCloudClient';

function envelope(name: string, extra: Record<string, unknown> = {}, version = SCHEMA_VERSION) {
  return JSON.stringify({
    version,
    savedAt: '2026-01-01T00:00:00.000Z',
    character: { ...INITIAL_CHARACTER, name, ...extra },
  });
}

describe('parseBulkText', () => {
  it('reads a builder export and drops the cloud bookmark', () => {
    const out = parseBulkText(envelope('Hinata', { cloudId: 'old-row' }), 'hinata.json');
    expect(out.errors).toEqual([]);
    expect(out.items).toHaveLength(1);
    expect(out.items[0].name).toBe('Hinata');
    expect(out.items[0].source).toBe('hinata.json');
    expect(out.items[0].character.cloudId).toBeUndefined();
  });

  it('reads every player out of a coach backup', () => {
    const text = JSON.stringify({
      version: 1,
      savedAt: '2026-01-01T00:00:00.000Z',
      coach: {
        teamName: 'Karasuno',
        roster: [
          { id: 'r1', character: { ...INITIAL_CHARACTER, name: 'Kageyama' }, number: 9, position: 'S' },
          { id: 'r2', character: { ...INITIAL_CHARACTER, name: '' }, number: null, position: null },
          { id: 'r3', number: 4 }, // no character: skipped silently
        ],
        lineup: null,
      },
    });
    const out = parseBulkText(text, 'team.json');
    expect(out.errors).toEqual([]);
    expect(out.items.map((i) => [i.name, i.source])).toEqual([
      ['Kageyama', 'team.json (player 1)'],
      ['Unnamed Player', 'team.json (player 2)'],
    ]);
  });

  it('reads a bare character object and a JSON array of mixed shapes', () => {
    const bare = JSON.stringify({ ...INITIAL_CHARACTER, name: 'Tsukishima' });
    expect(parseBulkText(bare, 'bare.json').items.map((i) => i.name)).toEqual(['Tsukishima']);

    const list = JSON.stringify([
      JSON.parse(envelope('A')),
      { ...INITIAL_CHARACTER, name: 'B' },
      { nonsense: true },
    ]);
    const out = parseBulkText(list, 'many.json');
    expect(out.items.map((i) => [i.name, i.source])).toEqual([
      ['A', 'many.json [1]'],
      ['B', 'many.json [2]'],
    ]);
    expect(out.errors).toEqual(['many.json [3]: not a character export, coach backup or character object.']);
  });

  it('migrates an old-schema export like the single-file import does', () => {
    // v1 saves lack ability uids; adoptCharacter injects them.
    const text = envelope('Old', {
      selectedAbilities: [{ abilityId: 'growth-spurt', tier: 0, chooserSelections: {} }],
    }, 1);
    const out = parseBulkText(text, 'old.json');
    expect(out.errors).toEqual([]);
    expect(out.items[0].character.selectedAbilities[0].uid).toBeTruthy();
  });

  it('reports unreadable files without throwing', () => {
    expect(parseBulkText('{not json', 'broken.json').errors).toEqual(['broken.json: not valid JSON.']);
    expect(parseBulkText('[]', 'empty.json').errors).toEqual(['empty.json: the file holds an empty list.']);
    expect(parseBulkText('42', 'num.json').errors).toEqual(['num.json: not a character file.']);
    expect(parseBulkText(envelope('X', {}, 99), 'future.json').errors[0]).toMatch(/Schema version mismatch/);
    expect(parseBulkText(JSON.stringify({ version: 1, coach: { roster: [] } }), 'team.json').errors)
      .toEqual(['team.json: the coach backup has no players.']);
    expect(parseBulkText(JSON.stringify({ version: 3, character: { name: 'x' } }), 'thin.json').errors[0])
      .toMatch(/malformed or incomplete/);
  });
});

describe('bulkUpload', () => {
  it('inserts one private row per character for the signed-in user, in order', async () => {
    let n = 0;
    const db = makeFakeDb((call) => {
      if (call.op !== 'insert') return { data: null, error: null };
      n += 1;
      if (call.values?.name === 'Bad') return { data: null, error: { message: 'row too big' } };
      return { data: { id: `row-${n}` }, error: null };
    });
    const items = ['Good', 'Bad', 'Also good'].map((name) =>
      parseBulkText(envelope(name, { cloudId: 'stale' }), `${name}.json`).items[0],
    );
    const progress: Array<[number, number]> = [];

    const outcomes = await bulkUpload(db.client, 'user-1', items, (done, total) => progress.push([done, total]));

    expect(outcomes.map((o) => [o.item.name, o.ok])).toEqual([['Good', true], ['Bad', false], ['Also good', true]]);
    expect(outcomes[1].error).toBe('row too big');
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);

    const inserts = db.calls.filter((c) => c.op === 'insert');
    expect(inserts).toHaveLength(3);
    for (const call of inserts) {
      expect(call.table).toBe('characters');
      expect(call.values?.owner_id).toBe('user-1');
      expect(call.values?.is_public).toBe(false);
      expect(call.values?.schema_version).toBe(SCHEMA_VERSION);
      expect((call.values?.data as Record<string, unknown>).cloudId).toBeUndefined();
    }
    expect(db.calls.some((c) => c.op === 'update')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers behind the Characters table screen: merge the signed-in user's
// own rows with the public listing, then search and sort the result.
// No React, no client — everything here is unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

import type { CloudCharacterSummary } from './types';
import { yearBadge } from './format';

export type RowSource = 'mine' | 'public';

export interface CharacterTableRow extends CloudCharacterSummary {
  /** 'mine' when the viewer owns the row (they may edit it), else 'public'. */
  source: RowSource;
  /** Owner column text: the viewer's own name for their rows, else the owner's. */
  ownerLabel: string;
  /** Pre-computed year text so search and sort agree with what is rendered. */
  yearLabel: string;
}

export type TableScope = 'all' | 'mine' | 'public';

export type SortKey =
  | 'owner'
  | 'name'
  | 'year'
  | 'height'
  | 'vertical'
  | 'abilities'
  | 'visibility'
  | 'updated';

export interface SortSpec {
  key: SortKey;
  direction: 'asc' | 'desc';
}

export const DEFAULT_SORT: SortSpec = { key: 'updated', direction: 'desc' };

/**
 * Combine the viewer's own characters with the public listing.
 * A public row that is also the viewer's appears once, as 'mine', so the
 * editable actions are offered and the owner reads as the viewer.
 */
export function mergeCharacterRows(
  mine: CloudCharacterSummary[],
  publicRows: CloudCharacterSummary[],
  viewerName: string | null,
): CharacterTableRow[] {
  const ownLabel = viewerName?.trim() || 'You';
  const seen = new Set<string>();
  const rows: CharacterTableRow[] = [];

  for (const row of mine) {
    seen.add(row.id);
    rows.push({
      ...row,
      source: 'mine',
      ownerLabel: ownLabel,
      yearLabel: yearBadge(row.schoolYear, row.graduated),
    });
  }
  for (const row of publicRows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push({
      ...row,
      isPublic: true,
      source: 'public',
      ownerLabel: row.ownerUsername?.trim() || 'unknown player',
      yearLabel: yearBadge(row.schoolYear, row.graduated),
    });
  }
  return rows;
}

/** Case-insensitive substring match over owner, name and year; scope narrows first. */
export function filterRows(
  rows: CharacterTableRow[],
  query: string,
  scope: TableScope,
): CharacterTableRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (scope === 'mine' && row.source !== 'mine') return false;
    if (scope === 'public' && !row.isPublic) return false;
    if (q === '') return true;
    return (
      row.ownerLabel.toLowerCase().includes(q) ||
      row.name.toLowerCase().includes(q) ||
      row.yearLabel.toLowerCase().includes(q)
    );
  });
}

/**
 * Rows missing the sort value sink to the bottom in EITHER direction.
 * Returns null when both values are present (compare normally), otherwise the
 * final ordering for this pair, which must not be flipped by the direction.
 */
function nullsLast(a: unknown, b: unknown): number | null {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return null;
}

/** ISO-8601 timestamps sort correctly as plain strings. */
function compareIso(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/** Stable sort by the chosen column; ties fall back to name then id. */
export function sortRows(rows: CharacterTableRow[], sort: SortSpec): CharacterTableRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const keyed = rows.map((row, index) => ({ row, index }));
  keyed.sort((x, y) => {
    const a = x.row;
    const b = y.row;
    let cmp = 0;
    let fixed: number | null = null; // null-placement result, immune to direction
    switch (sort.key) {
      case 'owner':      cmp = compareStrings(a.ownerLabel, b.ownerLabel); break;
      case 'name':       cmp = compareStrings(a.name, b.name); break;
      case 'year': {
        const ya = yearRank(a); const yb = yearRank(b);
        fixed = nullsLast(ya, yb);
        if (fixed === null) cmp = (ya as number) - (yb as number);
        break;
      }
      case 'height':
        fixed = nullsLast(a.heightCm, b.heightCm);
        if (fixed === null) cmp = (a.heightCm as number) - (b.heightCm as number);
        break;
      case 'vertical':
        fixed = nullsLast(a.verticalCm, b.verticalCm);
        if (fixed === null) cmp = (a.verticalCm as number) - (b.verticalCm as number);
        break;
      case 'abilities':  cmp = a.abilityCount - b.abilityCount; break;
      case 'visibility': cmp = Number(a.isPublic) - Number(b.isPublic); break;
      case 'updated':
        fixed = nullsLast(a.updatedAt, b.updatedAt);
        if (fixed === null) cmp = compareIso(a.updatedAt as string, b.updatedAt as string);
        break;
    }
    if (fixed !== null && fixed !== 0) return fixed;
    if (cmp !== 0) return cmp * sign;
    const byName = compareStrings(a.name, b.name);
    if (byName !== 0) return byName;
    return x.index - y.index;
  });
  return keyed.map((k) => k.row);
}

/** Graduate sorts after 3rd year; unknown years last. */
function yearRank(row: CharacterTableRow): number | null {
  if (row.graduated) return 4;
  return row.schoolYear;
}

/** Click on a header: same key flips direction, new key starts ascending (updated: descending). */
export function nextSort(current: SortSpec, key: SortKey): SortSpec {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: key === 'updated' ? 'desc' : 'asc' };
}

// src/export/weeklyCsv.ts
// Standalone CSV export of the Weekly match log — the character's audit trail.
//
// Rows only, no summary block, so the file imports cleanly into a spreadsheet
// or a script. The on-screen panel and the Excel workbook carry the totals.

import type { Character } from '../types';
import { MATCH_RESULT_LABEL, weeklyMatchesOf } from '../types';
import { safeFileName } from './excel';

export const WEEKLY_CSV_COLUMNS = [
  'Match',
  'Result',
  'AP Gained',
  'Running AP',
  'School Year',
  'Recorded At',
  'Note',
] as const;

/** RFC 4180 field: quote whenever the value could otherwise break the row. */
function csvField(value: string | number): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvField).join(',');
}

/** Pure: the full CSV text for a character's weekly match log. */
export function buildWeeklyMatchCsv(character: Character): string {
  const matches = weeklyMatchesOf(character);
  const lines = [csvRow([...WEEKLY_CSV_COLUMNS])];
  let runningAp = 0;
  matches.forEach((match, i) => {
    runningAp += match.apGained;
    lines.push(
      csvRow([
        i + 1,
        MATCH_RESULT_LABEL[match.result],
        match.apGained,
        runningAp,
        match.year,
        match.recordedAt,
        match.note,
      ]),
    );
  });
  return lines.join('\r\n') + '\r\n';
}

export function weeklyCsvFileName(character: Character): string {
  return `${safeFileName(character.name)}-match-log.csv`;
}

/** Trigger a browser download of the match log CSV. */
export function downloadWeeklyMatchCsv(character: Character): void {
  // Leading BOM so Excel reads the notes as UTF-8 rather than the local codepage.
  const blob = new Blob(['﻿' + buildWeeklyMatchCsv(character)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = weeklyCsvFileName(character);
  a.click();
  URL.revokeObjectURL(url);
}

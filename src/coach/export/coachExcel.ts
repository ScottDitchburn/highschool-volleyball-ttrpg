// Coach Excel export — one workbook for the whole team: a roster table (one
// row per player with reaches and all ten effective stats), the starting
// lineup, and an ability-per-row breakdown. Reuses the single-character
// export's cell helpers so both workbooks look the same.

import type { CoachState, RosterPlayer, CourtSlot } from '../types';
import { COURT_SLOTS } from '../types';
import { SKILL_STAT_NAMES, positionCodes, profileOf } from '../../types';
import { computeAPBudget } from '../../engine/apEngine';
import { deriveForPlayer, yearLabel } from '../playerStats';
import { abilityLabels } from '../abilityLabels';
import {
  header, text, num, safeFileName, saveWorkbook,
  type XlsxRow, type XlsxSheet,
} from '../../export/excel';

const NUM2 = '0.00';

function playerName(p: RosterPlayer | null | undefined): string {
  return p ? p.character.name || 'Unnamed' : '';
}

function rosterSheet(coach: CoachState): XlsxSheet {
  const rows: XlsxRow[] = [
    header(
      '#', 'Pos', 'Name', 'Year', 'Preferred', 'Height (cm)', 'Vertical (cm)',
      'Standing Reach', 'Spiking Reach', 'Blocking Reach',
      ...SKILL_STAT_NAMES, 'AP Spent', 'AP Total', 'Abilities',
    ),
  ];
  for (const p of coach.roster) {
    const { effectiveStats, reaches, effectiveHeightCm } = deriveForPlayer(p.character);
    const ap = computeAPBudget(p.character);
    rows.push([
      num(p.number),
      text(p.position ?? ''),
      text(playerName(p)),
      text(yearLabel(p.character.schoolYear)),
      text(positionCodes(profileOf(p.character).positions)),
      num(effectiveHeightCm, '0.0'),
      num(reaches?.effectiveVerticalCm ?? p.character.physical?.verticalCm ?? null),
      num(reaches?.standingReachCm ?? null, '0.0'),
      num(reaches?.spikingReachCm ?? null, '0.0'),
      num(reaches?.blockingReachCm ?? null, '0.0'),
      ...SKILL_STAT_NAMES.map((s) => num(effectiveStats?.[s] ?? null, NUM2)),
      num(ap.spent),
      num(ap.total),
      text(abilityLabels(p.character).join('; ')),
    ]);
  }
  if (coach.roster.length === 0) rows.push([text('(no players)')]);
  return {
    sheet: 'Roster',
    columns: [
      { width: 5 }, { width: 5 }, { width: 22 }, { width: 6 }, { width: 14 }, { width: 12 }, { width: 13 },
      { width: 15 }, { width: 14 }, { width: 15 },
      ...SKILL_STAT_NAMES.map(() => ({ width: 9 })),
      { width: 9 }, { width: 9 }, { width: 60 },
    ],
    data: rows,
  };
}

function lineupSheet(coach: CoachState): XlsxSheet {
  const byId = (id: string | null): RosterPlayer | null =>
    id ? coach.roster.find((p) => p.id === id) ?? null : null;
  const rows: XlsxRow[] = [header('Slot', '#', 'Pos', 'Name')];
  for (const slot of COURT_SLOTS as CourtSlot[]) {
    const p = byId(coach.lineup.slots[slot]);
    rows.push([text(slot === 'I' ? 'I (serve)' : slot), num(p?.number ?? null), text(p?.position ?? ''), text(playerName(p))]);
  }
  const lib = byId(coach.lineup.libero);
  rows.push([text('Libero'), num(lib?.number ?? null), text(lib?.position ?? ''), text(playerName(lib))]);
  return { sheet: 'Lineup', columns: [{ width: 10 }, { width: 5 }, { width: 5 }, { width: 22 }], data: rows };
}

function abilitiesSheet(coach: CoachState): XlsxSheet {
  const rows: XlsxRow[] = [header('#', 'Name', 'Ability')];
  for (const p of coach.roster) {
    for (const label of abilityLabels(p.character)) {
      rows.push([num(p.number), text(playerName(p)), text(label)]);
    }
  }
  if (rows.length === 1) rows.push([text('(no abilities)')]);
  return { sheet: 'Abilities', columns: [{ width: 5 }, { width: 22 }, { width: 50 }], data: rows };
}

/** Pure: every sheet of the coach workbook. */
export function buildCoachWorkbook(coach: CoachState): XlsxSheet[] {
  return [rosterSheet(coach), lineupSheet(coach), abilitiesSheet(coach)];
}

export function coachExcelFileName(coach: CoachState): string {
  return `${safeFileName(coach.teamName, 'team')}-haikyu-coach.xlsx`;
}

export async function downloadCoachExcel(coach: CoachState): Promise<void> {
  await saveWorkbook(buildCoachWorkbook(coach), coachExcelFileName(coach));
}

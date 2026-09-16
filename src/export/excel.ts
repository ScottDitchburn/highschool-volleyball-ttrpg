// src/export/excel.ts
// Excel (.xlsx) export of a single character.
//
// The workbook is built as plain sheet data (pure, testable in node) and only
// the download step touches the browser: `write-excel-file` is loaded lazily so
// the main bundle does not carry the xlsx writer until the button is pressed.

import type { Character, SkillStats, DerivedReaches } from '../types';
import { SKILL_STAT_NAMES, formatVerticalModifier } from '../types';
import { ABILITY_MAP } from '../data/abilities';
import { computeAPBudget } from '../engine/apEngine';
import { cumulativeCost } from '../engine/prereqEngine';
import { cmToImperial } from '../utils/units';
import { choiceLabels } from '../utils/abilityChoices';

// ── Minimal cell/sheet model (mirrors write-excel-file's SheetData) ───────────

export interface XlsxCell {
  value?: string | number | boolean | Date;
  type?: StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor;
  fontWeight?: 'bold';
  format?: string;
  align?: 'left' | 'center' | 'right';
  wrap?: boolean;
  backgroundColor?: string;
}
export type XlsxRow = (XlsxCell | null)[];
export interface XlsxSheet {
  sheet: string;
  columns?: { width?: number }[];
  data: XlsxRow[];
}

const HEADER_BG = '#F3E3D3';
const NUM2 = '0.00';

export function header(...labels: string[]): XlsxRow {
  return labels.map((value) => ({ value, type: String, fontWeight: 'bold', backgroundColor: HEADER_BG }));
}
export function text(value: string | null | undefined): XlsxCell {
  return { value: value ?? '', type: String };
}
export function num(value: number | null | undefined, format?: string): XlsxCell | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return format ? { value, type: Number, format } : { value, type: Number };
}
export function bool(value: boolean): XlsxCell {
  return { value: value ? 'Yes' : 'No', type: String };
}

export function yearLabel(y: number): string {
  if (y === 1) return '1st Year';
  if (y === 2) return '2nd Year';
  return '3rd Year';
}
export function toRoman(n: number): string {
  const map: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  return map[n] ?? String(n);
}

/** Filesystem-safe base name for a character's export files. */
export function safeFileName(name: string | null | undefined, fallback = 'unnamed'): string {
  const base = (name || fallback).replace(/[^a-z0-9_-]/gi, '_');
  return base || fallback;
}

// ── Sheet builders ────────────────────────────────────────────────────────────

function summarySheet(
  character: Character,
  derived: DerivedReaches | null,
): XlsxSheet {
  const p = character.physical;
  const ap = computeAPBudget(character);
  const rows: XlsxRow[] = [header('Field', 'Value')];
  const kv = (label: string, cell: XlsxCell | null) => rows.push([text(label), cell]);

  kv('Name', text(character.name || 'Unnamed Player'));
  kv('School Year', text(character.graduated ? 'Graduate' : yearLabel(character.schoolYear)));
  kv('Graduated', bool(character.graduated === true));
  kv('Seeded Run', bool(character.seeded));
  if (character.seeded && character.seed) kv('Seed', text(character.seed));

  rows.push([]);
  rows.push(header('Physical', ''));
  if (p) {
    const effH = derived?.effectiveHeightCm ?? p.heightCm;
    const effV = derived?.effectiveVerticalCm ?? p.verticalCm;
    kv('Height Roll (3d10)', num(p.heightRoll));
    kv('Height (cm)', num(p.heightCm, '0.0'));
    kv('Height Bonus (cm)', num(effH - p.heightCm, '0.0'));
    kv('Effective Height (cm)', num(effH, '0.0'));
    kv('Effective Height (imperial)', text(cmToImperial(effH)));
    kv('Vertical Jump Roll (3d10)', num(p.verticalRoll));
    kv('Height - Vert Jump Modifier', text(formatVerticalModifier(p.verticalModifier)));
    kv('Vertical Jump (cm)', num(p.verticalCm));
    kv('Vertical Jump Bonus (cm)', num(effV - p.verticalCm));
    kv('Effective Vertical Jump (cm)', num(effV));
  } else {
    kv('Physical attributes', text('not assigned'));
  }

  rows.push([]);
  rows.push(header('Reaches', ''));
  if (derived) {
    kv('Standing Reach (cm)', num(derived.standingReachCm, '0.0'));
    kv('Spiking Reach (cm)', num(derived.spikingReachCm, '0.0'));
    kv('Blocking Reach (cm)', num(derived.blockingReachCm, '0.0'));
    kv('Blocking Coefficient', num(derived.blockingCoef, NUM2));
  } else {
    kv('Reaches', text('physical not set'));
  }

  rows.push([]);
  rows.push(header('Ability Points', ''));
  kv('Year Roll (1d3)', num(character.yearRoll));
  kv('Experience Roll (2d8)', num(character.experience?.roll));
  kv('Experience', text(character.experience?.label ?? ''));
  kv('Base AP', num(ap.base));
  kv('Year Bonus AP', num(ap.yearBonus));
  kv('Experience Bonus AP', num(ap.experienceBonus));
  kv('Level-Up AP Gains', num(ap.levelUpGains));
  kv('Total AP', num(ap.total));
  kv('Spent AP', num(ap.spent));
  kv('Remaining AP', num(ap.remaining));

  return { sheet: 'Summary', columns: [{ width: 30 }, { width: 22 }], data: rows };
}

function statsSheet(character: Character, effectiveStats: SkillStats | null): XlsxSheet {
  const rows: XlsxRow[] = [header('Stat', 'Base', 'Effective', 'Bonus')];
  for (const stat of SKILL_STAT_NAMES) {
    const base = character.skills?.[stat] ?? null;
    const eff = effectiveStats?.[stat] ?? null;
    const bonus = base !== null && eff !== null ? eff - base : null;
    rows.push([text(stat), num(base, NUM2), num(eff, NUM2), num(bonus, NUM2)]);
  }
  return { sheet: 'Stats', columns: [{ width: 12 }, { width: 10 }, { width: 10 }, { width: 10 }], data: rows };
}

function abilitiesSheet(character: Character): XlsxSheet {
  const rows: XlsxRow[] = [header('Ability', 'Tier', 'Tier Effect', 'Choices', 'AP Cost')];
  for (const sel of character.selectedAbilities) {
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability) {
      rows.push([text(sel.abilityId), num(sel.tier || null), null, null, null]);
      continue;
    }
    const tierLabel = sel.tier > 0 && ability.tiers?.[sel.tier - 1] ? ability.tiers[sel.tier - 1].label : '';
    rows.push([
      text(ability.name),
      sel.tier > 0 ? text(toRoman(sel.tier)) : null,
      text(tierLabel),
      text(choiceLabels(ability, sel).join(', ')),
      num(cumulativeCost(ability, sel.tier)),
    ]);
  }
  if (character.selectedAbilities.length === 0) rows.push([text('(none)')]);
  return {
    sheet: 'Abilities',
    columns: [{ width: 26 }, { width: 6 }, { width: 24 }, { width: 26 }, { width: 9 }],
    data: rows,
  };
}

function levelUpSheet(character: Character): XlsxSheet {
  const rows: XlsxRow[] = [
    header('Year', 'Season', 'Prelim Games', 'National Games', 'AP Gained', 'Height Gain (cm)', 'Graduated'),
  ];
  for (const r of character.levelUpHistory) {
    rows.push([
      num(r.year),
      text(r.season === 'summer' ? 'Summer Interhigh' : 'Spring Interhigh'),
      num(r.prelimGames),
      num(r.nationalGames),
      num(r.apGained),
      num(r.heightGainCm, '0.0'),
      bool(r.graduated === true),
    ]);
  }
  if (character.levelUpHistory.length === 0) rows.push([text('(no level-ups yet)')]);
  return {
    sheet: 'Level-Ups',
    columns: [{ width: 6 }, { width: 18 }, { width: 13 }, { width: 15 }, { width: 10 }, { width: 16 }, { width: 10 }],
    data: rows,
  };
}

function rollsSheet(character: Character): XlsxSheet {
  const rows: XlsxRow[] = [header('Pool', 'Die 1', 'Die 2', 'Die 3', 'Die 4', 'Result')];
  const { rollA, rollB } = character.physicalPool;
  const physicalRow = (label: string, roll: { dice: number[]; total: number } | null) => {
    if (!roll) return;
    rows.push([text(label), num(roll.dice[0]), num(roll.dice[1]), num(roll.dice[2]), null, num(roll.total)]);
  };
  physicalRow('Physical A (3d10)', rollA);
  physicalRow('Physical B (3d10)', rollB);
  character.skillPool.rolls.forEach((roll, i) => {
    if (!roll) return;
    rows.push([
      text(`Skill ${i + 1} (4d4 avg)`),
      num(roll.dice[0]), num(roll.dice[1]), num(roll.dice[2]), num(roll.dice[3]),
      num(roll.value, NUM2),
    ]);
  });
  if (rows.length === 1) rows.push([text('(nothing rolled yet)')]);
  return {
    sheet: 'Rolls',
    columns: [{ width: 20 }, { width: 7 }, { width: 7 }, { width: 7 }, { width: 7 }, { width: 9 }],
    data: rows,
  };
}

/** Pure: every sheet of the character workbook, ready for write-excel-file. */
export function buildCharacterWorkbook(
  character: Character,
  effectiveStats: SkillStats | null,
  derived: DerivedReaches | null,
): XlsxSheet[] {
  return [
    summarySheet(character, derived),
    statsSheet(character, effectiveStats),
    abilitiesSheet(character),
    levelUpSheet(character),
    rollsSheet(character),
  ];
}

// ── Browser download ──────────────────────────────────────────────────────────

/** Write the sheets to an .xlsx and hand it to the browser as a download. */
export async function saveWorkbook(sheets: XlsxSheet[], fileName: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(sheets).toFile(fileName);
}

export function characterExcelFileName(character: Character): string {
  return `${safeFileName(character.name)}-haikyu.xlsx`;
}

export async function downloadCharacterExcel(
  character: Character,
  effectiveStats: SkillStats | null,
  derived: DerivedReaches | null,
): Promise<void> {
  await saveWorkbook(
    buildCharacterWorkbook(character, effectiveStats, derived),
    characterExcelFileName(character),
  );
}

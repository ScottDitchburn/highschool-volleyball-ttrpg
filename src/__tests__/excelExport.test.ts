// Excel export: the workbook builders are pure and checked cell by cell here;
// a final test pushes the sheets through write-excel-file's node writer to
// prove the cell model is accepted and yields a real (zip-signature) .xlsx.
import { describe, it, expect } from 'vitest';
import { makePhysicalAttributes, type Character, type SkillStats } from '../types';
import { INITIAL_CHARACTER, computeEffectiveStats, computeDerived } from '../state/characterStore';
import {
  buildCharacterWorkbook, characterExcelFileName, safeFileName, type XlsxSheet,
} from '../export/excel';
import { buildCoachWorkbook, coachExcelFileName } from '../coach/export/coachExcel';
import { emptyCoachState, type CoachState } from '../coach/types';

function allStats(v: number): SkillStats {
  return { Spike: v, Serve: v, Pass: v, Dig: v, Set: v, Block: v, Speed: v, Power: v, IQ: v, Stamina: v };
}

function sampleCharacter(): Character {
  return {
    ...INITIAL_CHARACTER,
    name: 'Kenma K.',
    schoolYear: 2,
    physicalPool: { rollA: { dice: [5, 6, 7], total: 18 }, rollB: { dice: [3, 4, 5], total: 12 } },
    physical: makePhysicalAttributes(18, 12), // 184 cm; mod -5 -> eff roll 7 -> 60 cm
    skills: allStats(3),
    yearRoll: 2,
    experience: { roll: 9, bonus: 2, label: 'Middle School Team' },
    apBudget: { ...INITIAL_CHARACTER.apBudget, yearBonus: 7, experienceBonus: 2, levelUpGains: 7 },
    selectedAbilities: [
      { uid: 'g1', abilityId: 'growth-spurt', tier: 0, chooserSelections: {} },
      { uid: 'w1', abilityId: 'weight-lifting', tier: 0, chooserSelections: { 0: 'vertical' } },
      { uid: 'p1', abilityId: 'playcalling', tier: 2, chooserSelections: {} },
    ],
    levelUpHistory: [
      { season: 'summer', year: 2, prelimGames: 2, nationalGames: 1, apGained: 7, heightGainCm: 0 },
    ],
  };
}

function sheet(sheets: XlsxSheet[], name: string): XlsxSheet {
  const s = sheets.find((x) => x.sheet === name);
  if (!s) throw new Error(`missing sheet ${name}`);
  return s;
}
/** Value of the cell to the right of the first cell whose text is `label`. */
function lookup(s: XlsxSheet, label: string): unknown {
  const row = s.data.find((r) => r[0]?.value === label);
  if (!row) throw new Error(`missing row ${label}`);
  return row[1]?.value;
}

describe('buildCharacterWorkbook', () => {
  const c = sampleCharacter();
  const eff = computeEffectiveStats(c);
  const derived = computeDerived(c);
  const sheets = buildCharacterWorkbook(c, eff, derived);

  it('has the five sheets in order', () => {
    expect(sheets.map((s) => s.sheet)).toEqual(['Summary', 'Stats', 'Abilities', 'Level-Ups', 'Rolls']);
  });

  it('summary carries physical, modifier, reaches and AP', () => {
    const s = sheet(sheets, 'Summary');
    expect(lookup(s, 'Name')).toBe('Kenma K.');
    expect(lookup(s, 'School Year')).toBe('2nd Year');
    expect(lookup(s, 'Height (cm)')).toBe(184);
    expect(lookup(s, 'Height Bonus (cm)')).toBe(8);            // Growth Spurt
    expect(lookup(s, 'Effective Height (cm)')).toBe(192);
    expect(lookup(s, 'Height - Vert Jump Modifier')).toBe('-5');
    expect(lookup(s, 'Vertical Jump (cm)')).toBe(60);
    expect(lookup(s, 'Vertical Jump Bonus (cm)')).toBe(3);     // Weight Lifting: vertical
    expect(lookup(s, 'Effective Vertical Jump (cm)')).toBe(63);
    expect(lookup(s, 'Standing Reach (cm)')).toBeCloseTo(1.3 * 192, 5);
    expect(lookup(s, 'Spiking Reach (cm)')).toBeCloseTo(1.3 * 192 + 63, 5);
    expect(lookup(s, 'Experience')).toBe('Middle School Team');
    expect(lookup(s, 'Total AP')).toBe(10 + 7 + 2 + 7);
    expect(lookup(s, 'Spent AP')).toBe(9 + 3 + (2 + 0 + 2)); // Growth Spurt 9, Weight Lifting 3, Playcalling II 4
  });

  it('stats sheet lists base, effective and bonus for all ten stats', () => {
    const s = sheet(sheets, 'Stats');
    expect(s.data).toHaveLength(11);
    const stamina = s.data.find((r) => r[0]?.value === 'Stamina')!;
    expect(stamina[1]?.value).toBe(3);
    expect(stamina[2]?.value).toBe(2.5);   // Weight Lifting -0.5
    expect(stamina[3]?.value).toBe(-0.5);
    expect(stamina[2]?.format).toBe('0.00');
  });

  it('abilities sheet shows tier, tier effect, choices and cumulative cost', () => {
    const s = sheet(sheets, 'Abilities');
    const rows = s.data.slice(1).map((r) => r.map((c) => c?.value ?? null));
    expect(rows).toEqual([
      ['Growth Spurt', null, '', '', 9],
      ['Weight Lifting', null, '', '+3 cm Vertical Jump', 3],
      ['Playcalling', 'II', 'Oikawa Plays', '', 4],
    ]);
  });

  it('level-up and rolls sheets carry the history and raw dice', () => {
    const lu = sheet(sheets, 'Level-Ups');
    expect(lu.data[1].map((c) => c?.value)).toEqual([2, 'Summer Interhigh', 2, 1, 7, 0, 'No']);
    const rolls = sheet(sheets, 'Rolls');
    expect(rolls.data[1].map((c) => c?.value ?? null)).toEqual(['Physical A (3d10)', 5, 6, 7, null, 18]);
  });

  it('copes with a blank character', () => {
    const blank = buildCharacterWorkbook(INITIAL_CHARACTER, null, null);
    expect(lookup(sheet(blank, 'Summary'), 'Physical attributes')).toBe('not assigned');
    expect(sheet(blank, 'Abilities').data[1][0]?.value).toBe('(none)');
    expect(sheet(blank, 'Rolls').data[1][0]?.value).toBe('(nothing rolled yet)');
  });

  it('builds a safe file name', () => {
    expect(characterExcelFileName(c)).toBe('Kenma_K_-haikyu.xlsx');
    expect(safeFileName('')).toBe('unnamed');
    expect(safeFileName('///')).toBe('___');
  });
});

describe('buildCoachWorkbook', () => {
  const coach: CoachState = {
    ...emptyCoachState(),
    teamName: 'Nekoma',
    roster: [
      { id: 'r1', character: sampleCharacter(), number: 5, position: 'S' },
      { id: 'r2', character: { ...INITIAL_CHARACTER, name: 'Bench' }, number: null, position: null },
    ],
    lineup: { slots: { I: 'r1', II: null, III: null, IV: null, V: null, VI: null }, libero: null },
  };
  const sheets = buildCoachWorkbook(coach);

  it('roster row has number, position, reaches, ten stats, AP and abilities', () => {
    const roster = sheet(sheets, 'Roster');
    expect(roster.data[0]).toHaveLength(9 + 10 + 3);
    const row = roster.data[1].map((c) => c?.value ?? null);
    expect(row.slice(0, 5)).toEqual([5, 'S', 'Kenma K.', '2nd', 192]);
    expect(row[5]).toBe(63);
    expect(row[9 + 9]).toBe(2.5);                 // Stamina (last of the ten stats)
    expect(row[19]).toBe(16);                     // AP spent
    expect(row[21]).toContain('Playcalling (Tier II: Oikawa Plays)');
    // Unassigned player: blanks rather than zeros
    expect(roster.data[2][0]).toBeNull();
    expect(roster.data[2][4]).toBeNull();
  });

  it('lineup sheet lists the six slots and libero', () => {
    const lineup = sheet(sheets, 'Lineup');
    expect(lineup.data.map((r) => r[0]?.value)).toEqual(['Slot', 'I (serve)', 'II', 'III', 'IV', 'V', 'VI', 'Libero']);
    expect(lineup.data[1][3]?.value).toBe('Kenma K.');
    expect(lineup.data[2][3]?.value).toBe('');
  });

  it('abilities sheet has one row per player ability', () => {
    const ab = sheet(sheets, 'Abilities');
    expect(ab.data).toHaveLength(4);
    expect(ab.data[2].map((c) => c?.value)).toEqual([5, 'Kenma K.', 'Weight Lifting [+3 cm Vertical Jump]']);
  });

  it('builds a safe file name', () => {
    expect(coachExcelFileName(coach)).toBe('Nekoma-haikyu-coach.xlsx');
    expect(coachExcelFileName(emptyCoachState())).toBe('team-haikyu-coach.xlsx');
  });
});

describe('write-excel-file accepts the sheet model', () => {
  it('produces a zip-signed .xlsx from both workbooks', async () => {
    const { default: writeXlsxFile } = await import('write-excel-file/node');
    const c = sampleCharacter();
    const coach: CoachState = { ...emptyCoachState(), roster: [{ id: 'r1', character: c, number: 1, position: 'MB' }] };
    for (const sheets of [buildCharacterWorkbook(c, computeEffectiveStats(c), computeDerived(c)), buildCoachWorkbook(coach)]) {
      const buf = await writeXlsxFile(sheets).toBuffer();
      expect(buf.length).toBeGreaterThan(1000);
      expect(buf.subarray(0, 2).toString('latin1')).toBe('PK'); // zip container
    }
  });
});

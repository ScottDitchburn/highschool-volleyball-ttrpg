// src/export/discord.ts
// Build a Discord-friendly triple-backtick code block from a character.

import type { Character, SkillStats, DerivedReaches } from '../types';
import { SKILL_STAT_NAMES } from '../types';
import { ABILITY_MAP } from '../data/abilities';

const PAD = 14; // label column width

function pad(s: string, n = PAD): string {
  return s.padEnd(n, ' ');
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function yearLabel(y: number): string {
  if (y === 1) return '1st Year';
  if (y === 2) return '2nd Year';
  return '3rd Year';
}

function toRoman(n: number): string {
  const map: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  return map[n] ?? String(n);
}

/**
 * Build the full Discord export string for a character.
 * Wrapped in triple-backtick code block so it renders as monospace in Discord.
 * Kept under 1900 chars in most realistic cases; truncates abilities list if needed.
 */
export function buildDiscordExport(
  character: Character,
  effectiveStats: SkillStats | null,
  derived: DerivedReaches | null,
): string {
  const lines: string[] = [];

  const name = character.name || 'Unnamed Player';
  const year = yearLabel(character.schoolYear);
  const heightStr = character.physical
    ? `${character.physical.heightCm.toFixed(1)} cm`
    : '—';

  lines.push('╔══════════════════════════════════════╗');
  lines.push(`  ${name}`);
  lines.push(`  ${year}   |   Height: ${heightStr}`);
  lines.push('──────────────────────────────────────');

  // Reaches
  if (derived) {
    lines.push('  REACHES');
    lines.push(`  ${pad('Standing')}${fmt(derived.standingReachCm)} cm`);
    lines.push(`  ${pad('Spiking')} ${fmt(derived.spikingReachCm)} cm`);
    lines.push(`  ${pad('Blocking')}${fmt(derived.blockingReachCm)} cm`);
  } else {
    lines.push('  REACHES  (physical not set)');
  }

  lines.push('──────────────────────────────────────');

  // Skill stats
  lines.push('  STATS');
  if (effectiveStats) {
    // Two columns: left = Spike/Serve/Pass/Dig/Set, right = Block/Speed/Power/IQ/Stamina
    const left  = SKILL_STAT_NAMES.slice(0, 5);
    const right = SKILL_STAT_NAMES.slice(5);
    const maxLen = Math.max(...left.map(s => s.length), ...right.map(s => s.length));
    for (let i = 0; i < 5; i++) {
      const ls = left[i];
      const rs = right[i];
      const lv = effectiveStats[ls].toFixed(2);
      const rv = effectiveStats[rs].toFixed(2);
      lines.push(`  ${ls.padEnd(maxLen + 1)}${lv}    ${rs.padEnd(maxLen + 1)}${rv}`);
    }
  } else {
    lines.push('  (stats not assigned)');
  }

  lines.push('──────────────────────────────────────');

  // AP
  const ap = character.apBudget;
  lines.push(`  AP  ${ap.spent} spent / ${ap.total} total  (${ap.remaining} remaining)`);

  // Abilities
  if (character.selectedAbilities.length > 0) {
    lines.push('──────────────────────────────────────');
    lines.push('  ABILITIES');
    for (const sel of character.selectedAbilities) {
      const ability = ABILITY_MAP[sel.abilityId];
      if (!ability) continue;
      let label = ability.name;
      if (sel.tier > 0 && ability.tiers && ability.tiers[sel.tier - 1]) {
        label += ` (Tier ${toRoman(sel.tier)}: ${ability.tiers[sel.tier - 1].label})`;
      }
      // Chooser selections
      const choiceEntries = Object.entries(sel.chooserSelections);
      if (choiceEntries.length > 0) {
        const choices = choiceEntries.map(([, v]) =>
          Array.isArray(v) ? (v as string[]).join('+') : String(v)
        ).join(', ');
        label += ` [${choices}]`;
      }
      lines.push(`  • ${label}`);
    }
  }

  lines.push('╚══════════════════════════════════════╝');

  const body = lines.join('\n');

  // Level-up history footnote (compact)
  const historyNote = character.levelUpHistory.length > 0
    ? `\n[Level-up history: ${character.levelUpHistory.map(r =>
        `Y${r.fromYear}→Y${r.toYear} +${r.apGained}AP +${r.heightGainCm.toFixed(1)}cm`
      ).join(' | ')}]`
    : '';

  const full = '```\n' + body + historyNote + '\n```';

  // Discord message limit is 2000 chars; trim abilities if needed
  if (full.length > 1990) {
    const trimmed = '```\n' + body.slice(0, 1900) + '\n…(truncated)\n```';
    return trimmed;
  }
  return full;
}

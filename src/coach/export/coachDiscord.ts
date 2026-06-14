// Coach Discord export — a single triple-backtick code block: starting lineup at
// the top, then a condensed one-line-per-player roster. Built to stay under
// Discord's 2000-char limit for a full 12-player team.

import type { CoachState, RosterPlayer, CourtSlot } from '../types';
import { COURT_SLOTS } from '../types';
import { deriveForPlayer, yearLabel } from '../playerStats';

/** Compact "standing/spiking/blocking" reaches in whole cm, or — when unset. */
function reachTriple(p: RosterPlayer): string {
  const { reaches } = deriveForPlayer(p.character);
  if (!reaches) return '—';
  return `${Math.round(reaches.standingReachCm)}/${Math.round(reaches.spikingReachCm)}/${Math.round(
    reaches.blockingReachCm
  )}`;
}

function playerLabel(p: RosterPlayer | undefined | null): string {
  if (!p) return '—';
  const num = p.number !== null ? `#${p.number}` : '#--';
  const pos = p.position ? p.position : '--';
  const name = p.character.name || 'Unnamed';
  return `${num.padEnd(4)} ${pos.padEnd(2)} ${name}`;
}

export function buildCoachDiscordExport(coach: CoachState): string {
  const byId = (id: string | null): RosterPlayer | null =>
    id ? coach.roster.find((p) => p.id === id) ?? null : null;

  const lines: string[] = [];
  const team = coach.teamName || 'Unnamed Team';

  lines.push('╔══════════════════════════════════════╗');
  lines.push(`  ${team}`);
  lines.push('  Starting Lineup');
  lines.push('──────────────────────────────────────');

  // Lineup by rotation slot
  for (const slot of COURT_SLOTS as CourtSlot[]) {
    const tag = slot === 'I' ? `${slot} (serve)` : slot;
    lines.push(`  ${tag.padEnd(9)} ${playerLabel(byId(coach.lineup.slots[slot]))}`);
  }
  lines.push(`  ${'Libero'.padEnd(9)} ${playerLabel(byId(coach.lineup.libero))}`);

  lines.push('──────────────────────────────────────');
  lines.push(`  ROSTER (${coach.roster.length})`);
  lines.push('  reach = standing/spiking/blocking (cm)');

  if (coach.roster.length === 0) {
    lines.push('  (no players)');
  } else {
    for (const p of coach.roster) {
      const num = (p.number !== null ? `#${p.number}` : '#--').padEnd(4);
      const pos = (p.position ?? '--').padEnd(2);
      const yr = yearLabel(p.character.schoolYear).padEnd(3);
      const name = (p.character.name || 'Unnamed').slice(0, 16).padEnd(16);
      lines.push(`  ${num} ${pos} ${yr} ${name} ${reachTriple(p)}`);
    }
  }

  lines.push('╚══════════════════════════════════════╝');

  const body = lines.join('\n');
  const full = '```\n' + body + '\n```';
  if (full.length > 1990) {
    return '```\n' + body.slice(0, 1900) + '\n…(truncated)\n```';
  }
  return full;
}

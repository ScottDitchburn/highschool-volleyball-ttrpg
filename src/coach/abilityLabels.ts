// Human-readable ability labels for a character's selected abilities.
// Mirrors the format used by the single-character Print/Discord exports
// (tier suffix + chooser selections).

import type { Character } from '../types';
import { ABILITY_MAP } from '../data/abilities';

function toRoman(n: number): string {
  const map: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  return map[n] ?? String(n);
}

/** Ordered list of display labels for a character's selected abilities. */
export function abilityLabels(character: Character): string[] {
  const labels: string[] = [];
  for (const sel of character.selectedAbilities) {
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability) continue;
    let label = ability.name;
    if (sel.tier > 0 && ability.tiers && ability.tiers[sel.tier - 1]) {
      label += ` (Tier ${toRoman(sel.tier)}: ${ability.tiers[sel.tier - 1].label})`;
    }
    const choiceEntries = Object.entries(sel.chooserSelections);
    if (choiceEntries.length > 0) {
      const choices = choiceEntries
        .map(([, v]) => (Array.isArray(v) ? (v as string[]).join('+') : String(v)))
        .join(', ');
      label += ` [${choices}]`;
    }
    labels.push(label);
  }
  return labels;
}

// src/utils/abilityChoices.ts
// One place that turns a purchased instance's recorded choices into readable
// text, so the ability card, Review step, print sheet, Discord export and the
// coach roster all phrase a pick the same way.

import type { Ability, SelectedAbility, SkillStat } from '../types';

/**
 * Readable labels for every choice recorded on a purchased ability instance,
 * in effect order.
 *
 * - statDelta choosers store the stat name(s) → "Spike", "Speed + Power"
 * - optionChoice stores an option id → that option's label, e.g. "Major spin"
 *
 * Unresolved choices contribute nothing.
 */
export function choiceLabels(ability: Ability | undefined, sel: SelectedAbility): string[] {
  if (!ability?.effects) {
    // Unknown ability (e.g. imported from a newer build): fall back to raw values.
    return Object.values(sel.chooserSelections).map((v) =>
      Array.isArray(v) ? v.join(' + ') : String(v),
    );
  }

  const labels: string[] = [];
  ability.effects.forEach((effect, index) => {
    const choice = sel.chooserSelections[index];
    if (choice === undefined) return;

    if (effect.kind === 'optionChoice') {
      const option = effect.options.find((o) => o.id === choice);
      if (option) labels.push(option.label);
      return;
    }

    if (effect.kind === 'statDelta' && effect.choose) {
      const picks = (Array.isArray(choice) ? choice : [choice]) as SkillStat[];
      if (picks.length > 0) labels.push(picks.join(' + '));
    }
  });
  return labels;
}

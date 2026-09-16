// @vitest-environment jsdom
// The v.3 "choose one of the following" chooser: the ability card must render
// the options and record the pick, and every sheet/export must show it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AbilityCard } from '../components/AbilityCard';
import { ABILITY_MAP } from '../data/abilities';
import { choiceLabels } from '../utils/abilityChoices';
import { abilityLabels } from '../coach/abilityLabels';
import { buildDiscordExport } from '../export/discord';
import { computeEffectiveStats, computeDerived, INITIAL_CHARACTER } from '../state/characterStore';
import type { AbilityEvaluation } from '../engine/prereqEngine';
import type { Character, SelectedAbility, SkillStats } from '../types';

afterEach(() => cleanup());

beforeEach(() => {
  if (!window.matchMedia) {
    // @ts-expect-error test shim
    window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
  }
});

const evaluation: AbilityEvaluation = {
  prereqResults: [], eligible: true, maxedOut: false,
  affordable: true, needsChooser: false, tierCost: 3,
};

function allStats(val: number): SkillStats {
  return {
    Spike: val, Serve: val, Pass: val, Dig: val, Set: val,
    Block: val, Speed: val, Power: val, IQ: val, Stamina: val,
  };
}

function charWith(selectedAbilities: SelectedAbility[]): Character {
  return {
    ...INITIAL_CHARACTER,
    name: 'Chooser',
    skills: allStats(3.5),
    physical: { heightRoll: 15, verticalRoll: 10, heightCm: 180, verticalCm: 75 },
    selectedAbilities,
  };
}

describe('optionChoice chooser UI', () => {
  it('renders every Weight Lifting option and records the clicked one', () => {
    const onChooserChange = vi.fn();
    const instance: SelectedAbility = {
      uid: 'w1', abilityId: 'weight-lifting', tier: 0, chooserSelections: {},
    };
    render(
      <AbilityCard
        ability={ABILITY_MAP['weight-lifting']}
        evaluation={{ ...evaluation, needsChooser: true }}
        isSelected
        instances={[instance]}
        apRemaining={20}
        onSelect={() => {}}
        onDeselect={() => {}}
        onTierChange={() => {}}
        onChooserChange={onChooserChange}
      />,
    );

    expect(screen.getByRole('button', { name: '+0.25 Speed' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '+0.25 Power' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '+3 cm Vertical Jump' }));
    expect(onChooserChange).toHaveBeenCalledWith('w1', 0, 'vertical');
  });

  it('marks the recorded Flexibility option and shows its rules text', () => {
    const instance: SelectedAbility = {
      uid: 'f1', abilityId: 'flexibility', tier: 0, chooserSelections: { 0: 'midair-rotation' },
    };
    render(
      <AbilityCard
        ability={ABILITY_MAP['flexibility']}
        evaluation={evaluation}
        isSelected
        instances={[instance]}
        apRemaining={20}
        onSelect={() => {}}
        onDeselect={() => {}}
        onTierChange={() => {}}
        onChooserChange={() => {}}
      />,
    );

    const chosen = screen.getByRole('button', { name: 'Midair rotation' });
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Major spin' }).getAttribute('aria-pressed')).toBe('false');
    expect(
      screen.getByText(/rotate your core and shoulders midair/i),
    ).toBeTruthy();
  });

  it('does not offer Speed / Power / IQ / Stamina for a v.3 Training purchase', () => {
    const instance: SelectedAbility = {
      uid: 't1', abilityId: 'training', tier: 0, chooserSelections: {},
    };
    render(
      <AbilityCard
        ability={ABILITY_MAP['training']}
        evaluation={{ ...evaluation, needsChooser: true }}
        isSelected
        instances={[instance]}
        apRemaining={20}
        onSelect={() => {}}
        onDeselect={() => {}}
        onTierChange={() => {}}
        onChooserChange={() => {}}
      />,
    );

    for (const stat of ['Serve', 'Spike', 'Set', 'Pass', 'Dig', 'Block']) {
      expect(screen.getByRole('button', { name: stat })).toBeTruthy();
    }
    for (const stat of ['Speed', 'Power', 'IQ', 'Stamina']) {
      expect(screen.queryByRole('button', { name: stat })).toBeNull();
    }
  });
});

describe('recorded picks surface everywhere', () => {
  const char = charWith([
    { uid: 'f1', abilityId: 'flexibility', tier: 0, chooserSelections: { 0: 'spin' } },
    { uid: 'w1', abilityId: 'weight-lifting', tier: 0, chooserSelections: { 0: 'vertical' } },
    { uid: 't1', abilityId: 'training', tier: 0, chooserSelections: { 0: 'Spike' } },
  ]);

  it('choiceLabels resolves option ids to their labels', () => {
    expect(choiceLabels(ABILITY_MAP['flexibility'], char.selectedAbilities[0])).toEqual(['Major spin']);
    expect(choiceLabels(ABILITY_MAP['weight-lifting'], char.selectedAbilities[1]))
      .toEqual(['+3 cm Vertical Jump']);
    expect(choiceLabels(ABILITY_MAP['training'], char.selectedAbilities[2])).toEqual(['Spike']);
  });

  it('the Discord export lists each pick by label, not by raw id', () => {
    const text = buildDiscordExport(char, computeEffectiveStats(char), computeDerived(char));
    expect(text).toContain('Flexibility [Major spin]');
    expect(text).toContain('Weight Lifting [+3 cm Vertical Jump]');
    expect(text).toContain('Training [Spike]');
    expect(text).not.toContain('[spin]');
    // Weight Lifting's vertical option shows up in the header + reaches maths.
    expect(text).toContain('Vertical Jump: 78');
  });

  it('the coach roster labels match', () => {
    expect(abilityLabels(char)).toEqual([
      'Flexibility [Major spin]',
      'Weight Lifting [+3 cm Vertical Jump]',
      'Training [Spike]',
    ]);
  });
});

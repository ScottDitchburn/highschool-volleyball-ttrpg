// @vitest-environment jsdom
// Regression: a repeatable chooser ability (e.g. Quick Learner) must not allow
// adding another copy while an existing copy's stat choice is unmade — otherwise
// unallocated bonuses let you stack past the prereq before the effect applies.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, within, cleanup } from '@testing-library/react';
import { AbilityCard } from '../components/AbilityCard';
import { ABILITY_MAP } from '../data/abilities';
import type { SelectedAbility } from '../types';
import type { AbilityEvaluation } from '../engine/prereqEngine';

afterEach(() => cleanup());

beforeEach(() => {
  if (!window.matchMedia) {
    // @ts-expect-error shim
    window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
  }
});

const ability = ABILITY_MAP['quick-learner']; // maxTimes 5, chooser, prereq noStatAtLeast 3.75
const baseEval: AbilityEvaluation = {
  prereqResults: [{ met: true, label: 'No Stat 3.75+', prereq: { kind: 'noStatAtLeast', min: 3.75 } }],
  eligible: true, maxedOut: false, affordable: true, needsChooser: false, tierCost: 3,
};
const props = {
  ability, isSelected: true, apRemaining: 20,
  onSelect: () => {}, onDeselect: () => {}, onTierChange: () => {}, onChooserChange: () => {},
};

describe('repeatable chooser add-gating', () => {
  it('disables "Add" with a Choose… hint while an existing copy is unallocated', () => {
    const instances: SelectedAbility[] = [{ uid: 'u1', abilityId: 'quick-learner', tier: 0, chooserSelections: {} }];
    const { container } = render(<AbilityCard {...props} instances={instances} evaluation={{ ...baseEval, needsChooser: true }} />);
    const addBtn = within(container).getByRole('button', { name: /add another quick learner/i });
    expect((addBtn as HTMLButtonElement).disabled).toBe(true);
    expect(addBtn.textContent).toMatch(/choose/i);
  });

  it('enables "+ Add" once the existing copy has its stat choice', () => {
    const instances: SelectedAbility[] = [{ uid: 'u1', abilityId: 'quick-learner', tier: 0, chooserSelections: { 0: 'Serve' } }];
    const { container } = render(<AbilityCard {...props} instances={instances} evaluation={{ ...baseEval, needsChooser: false }} />);
    const addBtn = within(container).getByRole('button', { name: /add another quick learner/i });
    expect((addBtn as HTMLButtonElement).disabled).toBe(false);
    expect(addBtn.textContent).toMatch(/add/i);
  });

  it('blocks adding when the prereq now fails (a stat reached 3.75 via allocation)', () => {
    const instances: SelectedAbility[] = [{ uid: 'u1', abilityId: 'quick-learner', tier: 0, chooserSelections: { 0: 'Serve' } }];
    const { container } = render(<AbilityCard {...props} instances={instances}
      evaluation={{ ...baseEval, eligible: false, prereqResults: [{ met: false, label: 'No Stat 3.75+ (Serve is 3.75 — fails)', prereq: { kind: 'noStatAtLeast', min: 3.75 } }] }} />);
    const addBtn = within(container).getByRole('button', { name: /add another quick learner/i });
    expect((addBtn as HTMLButtonElement).disabled).toBe(true);
    expect(addBtn.textContent).toMatch(/locked/i);
  });
});

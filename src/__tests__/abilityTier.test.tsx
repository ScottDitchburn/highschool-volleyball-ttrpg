// @vitest-environment jsdom
// Regression: a selected single-purchase tiered ability must keep its tiers
// selectable. Previously the TierSelector gated on `eligible`, which flips to
// false once a single-purchase ability is "maxed" by being selected, freezing
// all tier buttons.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AbilityCard } from '../components/AbilityCard';
import { ABILITY_MAP } from '../data/abilities';
import type { SelectedAbility } from '../types';
import type { AbilityEvaluation } from '../engine/prereqEngine';

beforeEach(() => {
  if (!window.matchMedia) {
    // @ts-expect-error test shim
    window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
  }
});

describe('tier selectable after selection', () => {
  it('higher tiers are enabled and fire onTierChange for a selected tiered ability', () => {
    const ability = ABILITY_MAP['block-breaker']; // tiers I..V, base 3 AP
    const instance: SelectedAbility = { uid: 'u1', abilityId: 'block-breaker', tier: 1, chooserSelections: {} };
    // Selected => single-purchase ability is "maxed" (eligible=false) — the bug trigger
    const evaluation: AbilityEvaluation = {
      prereqResults: [{ met: true, label: 'Power 3.25+ (have 3.50)' }],
      eligible: false, maxedOut: true, affordable: true, needsChooser: false, tierCost: 3,
    };
    const onTierChange = vi.fn();

    render(
      <AbilityCard
        ability={ability}
        evaluation={evaluation}
        isSelected
        instances={[instance]}
        apRemaining={20}
        onSelect={() => {}}
        onDeselect={() => {}}
        onTierChange={onTierChange}
        onChooserChange={() => {}}
      />
    );

    // Tier II of block-breaker is "Tanka Spike"; its button has a matching title.
    const tierII = screen.getByTitle(/Tanka Spike/i);
    expect(tierII.hasAttribute('disabled')).toBe(false); // was frozen before the fix

    fireEvent.click(tierII);
    expect(onTierChange).toHaveBeenCalledWith('u1', 2);
  });
});

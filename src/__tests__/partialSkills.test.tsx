// @vitest-environment jsdom
// Regression: assigning skills one-at-a-time (partial skills object) must not crash.
// Previously computeEffectiveStats returned a partial object and CharacterSheet
// called .toFixed on undefined -> blank screen.
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { computeEffectiveStats, CharacterProvider, INITIAL_CHARACTER } from '../state/characterStore';
import { CharacterSheet } from '../components/CharacterSheet';
import type { Character } from '../types';

beforeEach(() => {
  // jsdom lacks matchMedia
  if (!window.matchMedia) {
    // @ts-expect-error test shim
    window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
  }
});

function partialChar(): Character {
  // Only ONE of ten skills assigned — the exact state during drag-assignment
  return { ...INITIAL_CHARACTER, name: 'Partial', skills: { Spike: 2.25 } as unknown as Character['skills'] };
}

describe('partial skill assignment', () => {
  it('computeEffectiveStats returns null until all ten skills are assigned', () => {
    expect(computeEffectiveStats(partialChar())).toBeNull();
  });

  it('CharacterSheet renders without throwing on a partial skills object', () => {
    const seeded = partialChar();
    localStorage.setItem('haikyu-gauntlet-character-v1', JSON.stringify({ version: 1, savedAt: new Date().toISOString(), character: seeded }));
    expect(() =>
      render(
        <CharacterProvider>
          <CharacterSheet />
        </CharacterProvider>
      )
    ).not.toThrow();
    localStorage.clear();
  });

  it('computeEffectiveStats returns a full block when all ten present', () => {
    const full: Character = { ...INITIAL_CHARACTER, skills: {
      Spike:2, Serve:2, Pass:2, Dig:2, Set:2, Block:2, Speed:2, Power:2, IQ:2, Stamina:2,
    }};
    const eff = computeEffectiveStats(full);
    expect(eff).not.toBeNull();
    expect(eff!.Spike).toBe(2);
  });
});

// @vitest-environment jsdom
// Integration tests for the Seeded Run feature: landing reveal + locked controls.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { CharacterProvider, INITIAL_CHARACTER } from '../state/characterStore';
import { PhysicalStep } from '../steps/PhysicalStep';
import { seededPhysicalRoll, seededSkillChip } from '../rng/seeded';
import type { Character } from '../types';

beforeEach(() => {
  localStorage.clear();
  if (!window.matchMedia) {
    // @ts-expect-error shim
    window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
  }
});

describe('landing seeded-run UI', () => {
  it('reveals a seed field + generator when the checkbox is ticked, gates Start', () => {
    render(<App />);
    const checkbox = screen.getByRole('checkbox', { name: /seeded run/i });
    // Before ticking: no seed field
    expect(screen.queryByPlaceholderText(/enter a seed/i)).toBeNull();
    fireEvent.click(checkbox);
    const seedInput = screen.getByPlaceholderText(/enter a seed/i);
    expect(seedInput).toBeTruthy();
    expect(screen.getByRole('button', { name: /generate a random seed/i })).toBeTruthy();

    // Start is disabled with a name but empty seed
    fireEvent.change(screen.getByPlaceholderText(/player's name/i), { target: { value: 'Seedy' } });
    const start = screen.getByRole('button', { name: /start seeded run/i });
    expect((start as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(seedInput, { target: { value: 'karasuno-2026' } });
    expect((start as HTMLButtonElement).disabled).toBe(false);
  });
});

function seededCharacter(seed: string): Character {
  const a = seededPhysicalRoll(seed, 0), b = seededPhysicalRoll(seed, 1);
  return {
    ...INITIAL_CHARACTER,
    name: 'Seeded',
    seed, seeded: true,
    physicalPool: { rollA: { dice: a.dice, total: a.total }, rollB: { dice: b.dice, total: b.total } },
    skillPool: { rolls: Array.from({ length: 10 }, (_, i) => { const c = seededSkillChip(seed, i); return { dice: c.dice, value: c.value }; }) },
  };
}

describe('locked controls in a seeded run', () => {
  it('PhysicalStep hides Roll and Re-roll controls but still shows the seeded values', () => {
    localStorage.setItem('haikyu-gauntlet-character-v1', JSON.stringify({
      version: 1, savedAt: new Date().toISOString(), character: seededCharacter('abc'),
    }));
    render(<CharacterProvider><PhysicalStep /></CharacterProvider>);
    // No roll button (locked)
    expect(screen.queryAllByRole('button', { name: /roll 3d10/i }).length).toBe(0);
    // No Re-roll All button (locked)
    expect(screen.queryByRole('button', { name: /re-roll all/i })).toBeNull();
    // Seeded value is visible (rollA total from the seed)
    const total = seededPhysicalRoll('abc', 0).total;
    expect(screen.getAllByText(String(total)).length).toBeGreaterThan(0);
    // Lock indicator present
    expect(screen.getAllByText(/seeded/i).length).toBeGreaterThan(0);
  });
});

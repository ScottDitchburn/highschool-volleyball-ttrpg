// @vitest-environment jsdom
// Traits (two per character), preferred positions and bio.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import {
  TRAITS, TRAIT_MAP, FIRST_TRAIT_OPTIONS, SECOND_TRAIT_OPTIONS, isValidTraitForSlot, traitLabel,
} from '../data/traits';
import { seededTraits } from '../rng/seeded';
import { characterReducer, CharacterProvider, INITIAL_CHARACTER } from '../state/characterStore';
import { PlayerProfileCard } from '../components/PlayerProfileCard';
import { buildDiscordExport } from '../export/discord';
import { buildCharacterWorkbook } from '../export/excel';
import { toSummary } from '../cloud/characters';
import { STORAGE_KEY, SCHEMA_VERSION } from '../state/persistence';
import { positionCodes, profileOf, PREFERRED_POSITIONS, type Character } from '../types';

describe('trait data', () => {
  it('has the three lists with no duplicate ids and correct slot rules', () => {
    expect(TRAITS.filter((t) => t.kind === 'neutral')).toHaveLength(11);
    expect(TRAITS.filter((t) => t.kind === 'positive')).toHaveLength(17);
    expect(TRAITS.filter((t) => t.kind === 'negative')).toHaveLength(18);
    expect(new Set(TRAITS.map((t) => t.id)).size).toBe(TRAITS.length);
    expect(FIRST_TRAIT_OPTIONS.every((t) => t.kind !== 'negative')).toBe(true);
    expect(SECOND_TRAIT_OPTIONS.every((t) => t.kind !== 'positive')).toBe(true);
    expect(isValidTraitForSlot('angry', 0)).toBe(false);
    expect(isValidTraitForSlot('angry', 1)).toBe(true);
    expect(isValidTraitForSlot('calm', 1)).toBe(false);
    expect(isValidTraitForSlot('serious', 0)).toBe(true);
    expect(isValidTraitForSlot('serious', 1)).toBe(true);
    expect(isValidTraitForSlot(null, 0)).toBe(true);
    expect(isValidTraitForSlot('not-a-trait', 0)).toBe(false);
    expect(traitLabel('mood-swingy')).toBe('Mood Swingy');
  });

  it('seeded traits are deterministic and respect the slot rules', () => {
    const a = seededTraits('karasuno-2026');
    expect(seededTraits('karasuno-2026')).toEqual(a);
    expect(TRAIT_MAP[a[0]].kind).not.toBe('negative');
    expect(TRAIT_MAP[a[1]].kind).not.toBe('positive');
    // Every seed in a spread obeys the rules.
    for (let i = 0; i < 200; i++) {
      const [x, y] = seededTraits(`seed-${i}`);
      expect(TRAIT_MAP[x].kind).not.toBe('negative');
      expect(TRAIT_MAP[y].kind).not.toBe('positive');
    }
    expect(seededTraits('a')).not.toEqual(seededTraits('b'));
  });
});

describe('profile reducer', () => {
  it('records traits, positions and bio on a custom run', () => {
    let c = characterReducer(INITIAL_CHARACTER, { type: 'SET_TRAIT', slot: 0, traitId: 'calm' });
    c = characterReducer(c, { type: 'SET_TRAIT', slot: 1, traitId: 'serious' });
    c = characterReducer(c, { type: 'SET_POSITION', rank: 'primary', position: 'S' });
    c = characterReducer(c, { type: 'SET_POSITION', rank: 'secondary', position: 'OH' });
    c = characterReducer(c, { type: 'SET_BIO', bio: 'Quiet genius setter.' });
    expect(profileOf(c).traits).toEqual(['calm', 'serious']);
    expect(positionCodes(profileOf(c).positions)).toBe('S / OH');
    expect(profileOf(c).bio).toBe('Quiet genius setter.');
  });

  it('rejects a trait of the wrong kind for its slot', () => {
    const c = characterReducer(INITIAL_CHARACTER, { type: 'SET_TRAIT', slot: 0, traitId: 'angry' });
    expect(profileOf(c).traits).toEqual([null, null]);
  });

  it('a seeded run deals traits from the seed and keeps them locked', () => {
    const seeded = characterReducer(INITIAL_CHARACTER, { type: 'START_SEEDED_RUN', seed: 'nekoma' });
    expect(profileOf(seeded).traits).toEqual(seededTraits('nekoma'));
    const after = characterReducer(seeded, { type: 'SET_TRAIT', slot: 0, traitId: 'calm' });
    expect(profileOf(after).traits).toEqual(seededTraits('nekoma'));
  });

  it('a save without a profile still reads as an empty profile', () => {
    const legacy = { ...INITIAL_CHARACTER } as Character;
    delete (legacy as { profile?: unknown }).profile;
    expect(profileOf(legacy)).toEqual({ traits: [null, null], bio: '', positions: { primary: null, secondary: null, tertiary: null } });
  });
});

function seed(character: Character) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, savedAt: new Date().toISOString(), character }));
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('PlayerProfileCard', () => {
  it('offers full position names, hides a position already chosen elsewhere, and records picks', () => {
    render(<CharacterProvider><PlayerProfileCard /></CharacterProvider>);

    const primary = screen.getByRole('combobox', { name: /primary position/i });
    const names = within(primary).getAllByRole('option').map((o) => o.textContent);
    for (const p of PREFERRED_POSITIONS) expect(names).toContain(p.name);
    expect(names).not.toContain('S');

    fireEvent.change(primary, { target: { value: 'S' } });
    const secondary = screen.getByRole('combobox', { name: /secondary position/i });
    const secondaryNames = within(secondary).getAllByRole('option').map((o) => o.textContent);
    expect(secondaryNames).not.toContain('Setter');
    expect(secondaryNames).toContain('Outside Hitter');
  });

  it('trait dropdowns respect the slot rules', () => {
    render(<CharacterProvider><PlayerProfileCard /></CharacterProvider>);
    const first = within(screen.getByRole('combobox', { name: /^trait 1$/i })).getAllByRole('option').map((o) => o.textContent);
    const second = within(screen.getByRole('combobox', { name: /^trait 2$/i })).getAllByRole('option').map((o) => o.textContent);
    expect(first).toContain('Calm (positive)');
    expect(first).toContain('Serious (neutral)');
    expect(first).not.toContain('Angry (negative)');
    expect(second).toContain('Angry (negative)');
    expect(second).toContain('Serious (neutral)');
    expect(second).not.toContain('Calm (positive)');
  });

  it('shows seeded traits locked instead of as dropdowns', () => {
    seed(characterReducer({ ...INITIAL_CHARACTER, name: 'Kenma' }, { type: 'START_SEEDED_RUN', seed: 'nekoma' }));
    render(<CharacterProvider><PlayerProfileCard /></CharacterProvider>);
    expect(screen.queryByRole('combobox', { name: /^trait 1$/i })).toBeNull();
    const [a, b] = seededTraits('nekoma');
    expect(screen.getByTestId('trait-0').textContent).toContain(traitLabel(a));
    expect(screen.getByTestId('trait-1').textContent).toContain(traitLabel(b));
    expect(screen.getByText(/from seed/i)).toBeTruthy();
  });
});

describe('profile in outputs', () => {
  const c: Character = {
    ...INITIAL_CHARACTER,
    name: 'Kenma',
    profile: {
      traits: ['calm', 'lazy'],
      bio: 'Reads the whole court.',
      positions: { primary: 'S', secondary: 'BS', tertiary: null },
    },
  };

  it('Discord export uses trait labels and short position codes', () => {
    const text = buildDiscordExport(c, null, null);
    expect(text).toMatch(/Traits\s+Calm, Lazy/);
    expect(text).toMatch(/Positions\s+S \/ BS/);
    expect(text).not.toMatch(/Bench Sitter/);
    expect(text).toMatch(/Bio\s+Reads the whole court\./);
  });

  it('Excel summary carries traits, positions and bio', () => {
    const summary = buildCharacterWorkbook(c, null, null).find((s) => s.sheet === 'Summary')!;
    const value = (label: string) => summary.data.find((r) => r[0]?.value === label)?.[1]?.value;
    expect(value('Trait 1')).toBe('Calm');
    expect(value('Trait 2')).toBe('Lazy');
    expect(value('Primary Position')).toBe('S (Setter)');
    expect(value('Secondary Position')).toBe('BS (Bench Sitter)');
    expect(value('Bio')).toBe('Reads the whole court.');
  });

  it('table summaries expose trait labels and position codes', () => {
    const s = toSummary({ id: 'x', name: 'Kenma', schema_version: 3, data: c });
    expect(s.traits).toEqual(['Calm', 'Lazy']);
    expect(s.positions).toBe('S / BS');
  });
});

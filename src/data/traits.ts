// src/data/traits.ts
// Personality traits. Every character carries two: the first is positive or
// neutral, the second negative or neutral (both neutral is fine). Seeded runs
// draw them from the seed; custom runs pick them on the Review step.
//
// Data only — see DATA_NOTES.md for the source list and spelling notes.

import type { TraitKind } from '../types';

export interface Trait {
  /** Stable key stored on the character (kebab-case of the label). */
  id: string;
  label: string;
  kind: TraitKind;
}

const NEUTRAL = [
  'Serious', 'Goofball', 'Aggressive', 'Conservative', 'Sly', 'Bored', 'Quiet',
  'Loud', 'Obedient', 'Mood Swingy', 'Wealthy',
];

const POSITIVE = [
  'Calm', 'Nonchalant', 'Cheerful', 'Energetic', 'Honorable', 'Happy', 'Excited',
  'Inspiring', 'Confident', 'Motivated', 'Upbringing', 'Attractive', 'Competitive',
  'Attentive', 'Wholesome', 'Supportive', 'Trusting',
];

const NEGATIVE = [
  'Angry', 'Emo', 'Anxious', 'Egotistical', 'Mean', 'Cocky', 'Gloomy', 'Creepy',
  'Haughty', 'Lazy', 'Crazy', 'Unconfident', 'Unmotivated', 'Unattractive',
  'Clumsy', 'Awkward', 'Jealous', 'Demanding',
];

function make(labels: string[], kind: TraitKind): Trait[] {
  return labels.map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, kind }));
}

export const NEUTRAL_TRAITS: Trait[] = make(NEUTRAL, 'neutral');
export const POSITIVE_TRAITS: Trait[] = make(POSITIVE, 'positive');
export const NEGATIVE_TRAITS: Trait[] = make(NEGATIVE, 'negative');

export const TRAITS: Trait[] = [...POSITIVE_TRAITS, ...NEUTRAL_TRAITS, ...NEGATIVE_TRAITS];

export const TRAIT_MAP: Record<string, Trait> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

/** What the FIRST trait slot may hold: positive or neutral. */
export const FIRST_TRAIT_OPTIONS: Trait[] = [...POSITIVE_TRAITS, ...NEUTRAL_TRAITS];
/** What the SECOND trait slot may hold: negative or neutral. */
export const SECOND_TRAIT_OPTIONS: Trait[] = [...NEGATIVE_TRAITS, ...NEUTRAL_TRAITS];

/** True when `id` is allowed in the given slot (null = unset is always fine). */
export function isValidTraitForSlot(id: string | null, slot: 0 | 1): boolean {
  if (id === null) return true;
  const trait = TRAIT_MAP[id];
  if (!trait) return false;
  return slot === 0 ? trait.kind !== 'negative' : trait.kind !== 'positive';
}

/** Display label for a stored id ('' for unset, the raw id if unknown). */
export function traitLabel(id: string | null | undefined): string {
  if (!id) return '';
  return TRAIT_MAP[id]?.label ?? id;
}

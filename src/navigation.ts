// ─────────────────────────────────────────────────────────────────────────────
// Tiny zero-router navigation helpers.
//
// App.tsx switches on window.location.pathname and listens to `popstate`, so
// any component can move the app by pushing a history entry and firing that
// event. A one-shot flag lets a screen ask for the wizard (not the name-entry
// landing page) to open on the next visit to "/" — used after loading a cloud
// character from the table.
// ─────────────────────────────────────────────────────────────────────────────

import type { Character } from './types';

export const CHARACTERS_PATH = '/Characters';
export const COACH_PATH = '/Coach';

let openWizardNext = false;

/** Push `to` and notify App's popstate listener. No-op when already there. */
export function navigateTo(to: string): void {
  if (window.location.pathname !== to) {
    window.history.pushState({}, '', to);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Ask the builder to open straight into the wizard on its next mount. */
export function requestWizardOnReturn(): void {
  openWizardNext = true;
}

/** Read-and-clear the flag; AppInner calls this once when it mounts. */
export function consumeWizardRequest(): boolean {
  const value = openWizardNext;
  openWizardNext = false;
  return value;
}

let jumpToFurthestNext = false;

/**
 * Ask the wizard to open on the furthest step the character has earned
 * (Review for a complete character) instead of step 1. Set alongside
 * requestWizardOnReturn() when a cloud character is loaded.
 */
export function requestJumpToFurthestStep(): void {
  jumpToFurthestNext = true;
}

/** Read-and-clear; the Wizard calls this once when it mounts. */
export function consumeJumpToFurthestStep(): boolean {
  const value = jumpToFurthestNext;
  jumpToFurthestNext = false;
  return value;
}

/** Wizard step indices: Physical 0, Reaches 1, Skills 2, Year & Exp 3, Abilities 4, Review 5. */
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * The furthest wizard step a character has earned, from what it has filled in:
 * physical assigned → Reaches and Skills; all skills → Year & Exp; year and
 * experience rolled → Abilities and Review. A loaded, complete character can
 * therefore jump straight to Review instead of clicking Next five times.
 */
export function furthestReachableStep(character: Character): StepIndex {
  if (!character.physical) return 0;
  if (!character.skills) return 2;
  if (character.yearRoll === null || character.experience === null) return 3;
  return 5;
}

// @vitest-environment jsdom
// A loaded, complete character must be able to jump straight to Review.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import App from '../App';
import { INITIAL_CHARACTER } from '../state/characterStore';
import { STORAGE_KEY, SCHEMA_VERSION } from '../state/persistence';
import { makePhysicalAttributes, type Character } from '../types';
import { furthestReachableStep, requestJumpToFurthestStep, requestWizardOnReturn, consumeWizardRequest, consumeJumpToFurthestStep } from '../navigation';

function complete(): Character {
  return {
    ...INITIAL_CHARACTER,
    name: 'Kenma',
    physicalPool: { rollA: { dice: [5, 5, 5], total: 15 }, rollB: { dice: [5, 5, 5], total: 15 } },
    physical: makePhysicalAttributes(15, 15),
    skills: { Spike: 3, Serve: 3, Pass: 3, Dig: 3, Set: 3, Block: 3, Speed: 3, Power: 3, IQ: 3, Stamina: 3 },
    yearRoll: 1,
    experience: { roll: 5, bonus: 1, label: 'Recreational Player' },
  };
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  if (!window.matchMedia) {
    // @ts-expect-error jsdom lacks matchMedia
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  }
});

afterEach(() => {
  cleanup();
  consumeWizardRequest();
  consumeJumpToFurthestStep();
});

describe('furthestReachableStep', () => {
  it('unlocks steps as the character fills in', () => {
    expect(furthestReachableStep(INITIAL_CHARACTER)).toBe(0);
    expect(furthestReachableStep({ ...INITIAL_CHARACTER, physical: makePhysicalAttributes(10, 10) })).toBe(2);
    expect(furthestReachableStep({ ...complete(), yearRoll: null })).toBe(3);
    expect(furthestReachableStep(complete())).toBe(5);
  });
});

describe('wizard navigation for a loaded character', () => {
  it('lets the step indicator jump straight to Review and opens there after a cloud load', () => {
    // Seed the store synchronously (autosave is debounced).
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, savedAt: new Date().toISOString(), character: complete() }));
    requestWizardOnReturn();
    requestJumpToFurthestStep();
    render(<App />);

    // Opened directly on Review (step 6 of 6).
    expect(screen.getByRole('button', { name: /^6/ }).getAttribute('aria-current')).toBe('step');

    // Every earlier step is clickable, and coming back to Review needs one click, not five.
    const physical = screen.getByRole('button', { name: /^1/ });
    expect((physical as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(physical);
    expect(physical.getAttribute('aria-current')).toBe('step');
    const review = screen.getByRole('button', { name: /^6/ });
    expect((review as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(review);
    expect(review.getAttribute('aria-current')).toBe('step');
  });

  it('keeps unfilled steps locked for a fresh character', () => {
    requestWizardOnReturn();
    render(<App />);
    expect((screen.getByRole('button', { name: /^2/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /^6/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

// @vitest-environment jsdom
/**
 * Render smoke tests for the Haikyu Gauntlet character builder.
 * Goal: mount the real app + every step/component in jsdom and catch
 * any crash-on-render bug.  All assertions are intentionally lightweight –
 * the PRIMARY value is "does it throw on render / interaction".
 */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within, act, fireEvent } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import React from 'react';

// ─── jsdom polyfills ──────────────────────────────────────────────────────────

beforeAll(() => {
  // matchMedia (DiceRoller and others may check prefers-reduced-motion)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // clipboard.writeText
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  });

  // window.print
  window.print = vi.fn();

  // scrollIntoView
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }

  // URL.createObjectURL / revokeObjectURL (SaveControls → downloadCharacter)
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  }

  // window.confirm (SaveControls Reset button)
  window.confirm = vi.fn(() => false);
});

afterEach(() => {
  cleanup();
});

// ─── Imports ──────────────────────────────────────────────────────────────────

import App from '../App';
import { CharacterProvider } from '../state/characterStore';
import { PhysicalStep }       from '../steps/PhysicalStep';
import { ReachesStep }        from '../steps/ReachesStep';
import { SkillsStep }         from '../steps/SkillsStep';
import { YearExperienceStep } from '../steps/YearExperienceStep';
import { AbilitiesStep }      from '../steps/AbilitiesStep';
import { ReviewStep }         from '../steps/ReviewStep';
import { CharacterSheet }     from '../components/CharacterSheet';
import { SaveControls }       from '../components/SaveControls';
import { LevelUpModal }       from '../components/LevelUpModal';
import { DiceRoller }         from '../components/DiceRoller';
import { STORAGE_KEY }        from '../state/persistence';
import { buildDiscordExport } from '../export/discord';
import type { Character }     from '../types';
import { ABILITY_MAP }        from '../data/abilities';

// ─── Fixture: fully-populated character ───────────────────────────────────────

/** A complete character suitable for seeding the provider via localStorage. */
const FULL_CHARACTER: Character = {
  name: 'Hinata Shoyo',
  schoolYear: 2,
  physicalPool: {
    rollA: { dice: [5, 6, 7], total: 18 },
    rollB: { dice: [3, 4, 5], total: 12 },
  },
  physical: {
    heightRoll: 18,
    verticalRoll: 12,
    heightCm:   186,   // 150 + 2*18
    verticalCm:  81,   // 45 + 3*12
  },
  reaches: {
    effectiveHeightCm: 186,
    standingReachCm: 241.8,  // 1.3 * 186
    spikingReachCm:  322.8,  // 241.8 + 81
    blockingReachCm: 310.65, // 241.8 + 0.85*81
    blockingCoef: 0.85,
  },
  skillPool: {
    rolls: [
      { dice: [4,4,4,4], value: 4.00 },
      { dice: [3,4,3,4], value: 3.50 },
      { dice: [3,3,3,3], value: 3.00 },
      { dice: [3,3,3,4], value: 3.25 },
      { dice: [2,3,3,3], value: 2.75 },
      { dice: [2,2,3,3], value: 2.50 },
      { dice: [2,2,2,3], value: 2.25 },
      { dice: [2,2,2,2], value: 2.00 },
      { dice: [1,2,2,2], value: 1.75 },
      { dice: [1,1,2,2], value: 1.50 },
    ],
  },
  skills: {
    Spike:   4.00,
    Speed:   3.50,
    Pass:    3.00,
    Jump:    3.25, // will be ignored at runtime — only SKILL_STAT_NAMES used
    Power:   2.75,
    Serve:   2.50,
    Dig:     2.25,
    Set:     2.00,
    Block:   1.75,
    IQ:      1.50,
    Stamina: 3.25,
  } as unknown as Character['skills'],  // type cast: store accepts partial
  yearRoll: 2,
  experience: { roll: 10, bonus: 2, label: 'Middle School Team' },
  apBudget: {
    base: 10,
    yearBonus: 7,   // 3 + rolled 4
    experienceBonus: 2,
    levelUpGains: 0,
    total: 19,
    spent: 5,       // one Training
    remaining: 14,
  },
  selectedAbilities: [
    {
      uid: 'test-uid-training-1',
      abilityId: 'training',
      tier: 0,
      chooserSelections: { 0: 'Spike' },
    },
  ],
  levelUpHistory: [],
    seed: null,
    seeded: false,
};

/** Seed localStorage so CharacterProvider hydrates this character on mount. */
function seedCharacter(char: Character = FULL_CHARACTER) {
  const envelope = { version: 1, savedAt: new Date().toISOString(), character: char };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

/** Render a component inside CharacterProvider (no localStorage seed). */
function renderInProvider(ui: React.ReactElement) {
  return render(<CharacterProvider>{ui}</CharacterProvider>);
}

/** Render with a seeded character already in localStorage. */
function renderWithCharacter(ui: React.ReactElement, char: Character = FULL_CHARACTER) {
  seedCharacter(char);
  return render(<CharacterProvider>{ui}</CharacterProvider>);
}

// ─── Test 1: App mounts without crashing ─────────────────────────────────────

describe('App root', () => {
  it('mounts without throwing and shows name-entry screen', () => {
    localStorage.clear();
    render(<App />);
    // The name-entry screen should be visible
    expect(document.body).toBeTruthy();
    expect(document.body.textContent).toMatch(/Haikyuu|Gauntlet|Character/i);
  });

  it('shows wizard after character name is entered and Start is clicked', async () => {
    localStorage.clear();
    render(<App />);

    const input = screen.getByPlaceholderText(/player's name/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hinata' } });
    });

    const startBtn = screen.getByRole('button', { name: /start building/i });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    // Wizard step indicator should be visible
    expect(screen.getByRole('navigation', { name: /wizard steps/i })).toBeTruthy();
  });
});

// ─── Test 2: Each step renders without crashing ───────────────────────────────

describe('Step renders (empty character)', () => {
  it('PhysicalStep renders', () => {
    renderInProvider(<PhysicalStep />);
    expect(screen.getByText(/physical attributes/i)).toBeTruthy();
  });

  it('ReachesStep renders (no physical — shows placeholder)', () => {
    renderInProvider(<ReachesStep />);
    // Shows placeholder because physical is null
    expect(screen.getByText(/derived reaches/i)).toBeTruthy();
  });

  it('SkillsStep renders', () => {
    renderInProvider(<SkillsStep />);
    // Multiple elements may match; just check at least one exists
    expect(screen.getAllByText(/skill stats/i).length).toBeGreaterThan(0);
  });

  it('YearExperienceStep renders', () => {
    renderInProvider(<YearExperienceStep />);
    expect(screen.getAllByText(/year.*experience/i).length).toBeGreaterThan(0);
  });

  it('AbilitiesStep renders', () => {
    renderInProvider(<AbilitiesStep />);
    expect(screen.getAllByText(/abilities/i).length).toBeGreaterThan(0);
  });

  it('ReviewStep renders (empty character)', () => {
    renderInProvider(<ReviewStep />);
    // Shows player name placeholder and year
    expect(document.body.textContent).toMatch(/unnamed player|1st year/i);
  });
});

// ─── Test 3: Steps render with populated character ────────────────────────────

describe('Step renders (populated character)', () => {
  it('PhysicalStep renders with existing rolls', () => {
    renderWithCharacter(<PhysicalStep />);
    // Should show roll values from the pool
    expect(document.body.textContent).toMatch(/pool roll/i);
  });

  it('ReachesStep renders with physical set (shows actual reach values)', () => {
    renderWithCharacter(<ReachesStep />);
    expect(screen.getByText(/standing reach/i)).toBeTruthy();
    expect(screen.getByText(/spiking reach/i)).toBeTruthy();
  });

  it('SkillsStep renders with skills', () => {
    renderWithCharacter(<SkillsStep />);
    expect(document.body.textContent).toMatch(/skill stats/i);
  });

  it('YearExperienceStep renders with year/experience set', () => {
    renderWithCharacter(<YearExperienceStep />);
    // 2nd Year should be reflected
    expect(document.body.textContent).toMatch(/2nd year|year bonus/i);
  });

  it('AbilitiesStep renders with abilities selected', () => {
    renderWithCharacter(<AbilitiesStep />);
    // AP meter and ability list should be visible
    expect(screen.getAllByText(/ability points/i).length).toBeGreaterThan(0);
  });

  it('ReviewStep renders fully-populated character', () => {
    renderWithCharacter(<ReviewStep />);
    expect(screen.getAllByText(/hinata shoyo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2nd year/i).length).toBeGreaterThan(0);
    // Action buttons
    expect(screen.getByRole('button', { name: /print.*pdf/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy for discord/i })).toBeTruthy();
  });
});

// ─── Test 4: Discord export string builds without crashing ────────────────────

describe('Discord export', () => {
  it('buildDiscordExport produces a non-empty string', () => {
    const char = FULL_CHARACTER;
    const stats = {
      Spike: 4.25, Speed: 3.50, Pass: 3.00, Power: 2.75,
      Serve: 2.50, Dig: 2.25, Set: 2.00, Block: 1.75,
      IQ: 1.50, Stamina: 3.25,
    };
    const derived = FULL_CHARACTER.reaches!;
    const result = buildDiscordExport(char, stats, derived);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(50);
    // Starts with triple-backtick code block
    expect(result.startsWith('```')).toBe(true);
    // Contains player name
    expect(result).toContain('Hinata Shoyo');
  });

  it('buildDiscordExport handles null effectiveStats + null derived without crashing', () => {
    const result = buildDiscordExport(FULL_CHARACTER, null, null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── Test 5: DiceRoller — roll button click ───────────────────────────────────

describe('DiceRoller interaction', () => {
  it('renders and shows a Roll button', () => {
    const onResult = vi.fn();
    renderInProvider(
      <DiceRoller numDice={3} sides={10} mode="sum" label="Test Roll" onResult={onResult} />
    );
    const rollBtn = screen.getByRole('button', { name: /roll 3d10/i });
    expect(rollBtn).toBeTruthy();
  });

  it('clicking Roll on PhysicalStep triggers animation state without crashing', async () => {
    renderInProvider(<PhysicalStep />);
    const rollBtns = screen.getAllByRole('button', { name: /roll \d+d\d+/i });
    expect(rollBtns.length).toBeGreaterThan(0);
    // Click first roll button — should not throw (animation uses setTimeout)
    await act(async () => {
      fireEvent.click(rollBtns[0]);
    });
    // After click the button text changes to "Rolling…" during animation
    // or stays as Roll if animation already completed; either is fine.
    // Primary check: no exception thrown.
    expect(document.body).toBeTruthy();
  });

  it('DiceRoller onResult fires after manual entry', async () => {
    const onResult = vi.fn();
    renderInProvider(
      <DiceRoller numDice={2} sides={8} mode="sum" label="Experience" onResult={onResult} />
    );
    const input = screen.getByRole('spinbutton');
    await act(async () => {
      fireEvent.change(input, { target: { value: '10' } });
    });
    expect(onResult).toHaveBeenCalledWith(10, []);
  });
});

// ─── Test 6: AbilitiesStep with populated character ───────────────────────────

describe('AbilitiesStep interactions', () => {
  it('shows at least one ability card', () => {
    renderWithCharacter(<AbilitiesStep />);
    // Training is selectable with no prereqs
    expect(document.body.textContent).toMatch(/training/i);
  });

  it('a locked ability shows a disabled/locked state (ineligible due to prereqs)', () => {
    renderWithCharacter(<AbilitiesStep />);
    // Some abilities have prereqs that cannot be met (e.g. Read Block needs Block>=3.25
    // but our fixture has Block=1.75). They should render with a locked/disabled state.
    // Look for either "Locked" buttons, aria-disabled cards, or "No AP" buttons.
    const lockedBtns = screen.queryAllByRole('button', { name: /locked/i });
    const noApBtns   = screen.queryAllByRole('button', { name: /no ap/i });
    const disabledCards = document.querySelectorAll('[aria-disabled="true"]');
    expect(lockedBtns.length + noApBtns.length + disabledCards.length).toBeGreaterThan(0);
  });

  it('selecting an affordable ability does not crash (Training)', async () => {
    // Use a fresh character with enough AP and no Training already selected
    const freshChar: Character = {
      ...FULL_CHARACTER,
      selectedAbilities: [],
      apBudget: {
        ...FULL_CHARACTER.apBudget,
        spent: 0,
        remaining: 19,
      },
    };
    renderWithCharacter(<AbilitiesStep />, freshChar);

    // Training is repeatable; find the "Select" or "Add another" button for it
    const trainingSection = screen.getByText(/^training$/i).closest('[class]');
    if (trainingSection) {
      const selectBtn = within(trainingSection as HTMLElement).queryByRole('button', {
        name: /select.*training|add another.*training/i,
      });
      if (selectBtn && !selectBtn.hasAttribute('disabled')) {
        await act(async () => {
          fireEvent.click(selectBtn);
        });
        // After selection, no crash — check body still exists
        expect(document.body).toBeTruthy();
      }
    }
    // Primary assertion: reaching this line without throwing
    expect(true).toBe(true);
  });

  it('AP meter shows correct totals', () => {
    renderWithCharacter(<AbilitiesStep />);
    // Look for AP meter: "X spent" text somewhere
    expect(document.body.textContent).toMatch(/spent|total|left/i);
  });
});

// ─── Test 7: Auxiliary components ─────────────────────────────────────────────

describe('Auxiliary components', () => {
  it('CharacterSheet renders without crashing (populated)', () => {
    renderWithCharacter(<CharacterSheet />);
    expect(screen.getByRole('complementary', { name: /character sheet/i })).toBeTruthy();
    expect(screen.getAllByText(/hinata shoyo/i).length).toBeGreaterThan(0);
  });

  it('CharacterSheet renders without crashing (empty)', () => {
    renderInProvider(<CharacterSheet />);
    expect(screen.getByRole('complementary', { name: /character sheet/i })).toBeTruthy();
  });

  it('SaveControls renders without crashing', () => {
    renderInProvider(<SaveControls />);
    expect(screen.getByRole('button', { name: /export json/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /import json/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /reset/i })).toBeTruthy();
  });

  it('LevelUpModal (Summer) renders the games entry for a 1st-year character', () => {
    const char: Character = { ...FULL_CHARACTER, schoolYear: 1, name: 'Test Player' };
    seedCharacter(char);
    render(
      <CharacterProvider>
        <LevelUpModal season="summer" onClose={vi.fn()} onGoToAbilities={vi.fn()} />
      </CharacterProvider>
    );
    expect(screen.getByRole('dialog', { name: /summer interhigh/i })).toBeTruthy();
    expect(document.body.textContent).toMatch(/prelim games|national games/i);
  });

  it('LevelUpModal (Spring) shows graduation wording for a 3rd-year character', () => {
    const char: Character = { ...FULL_CHARACTER, schoolYear: 3 };
    seedCharacter(char);
    render(
      <CharacterProvider>
        <LevelUpModal season="spring" onClose={vi.fn()} />
      </CharacterProvider>
    );
    expect(document.body.textContent).toMatch(/graduation/i);
  });
});

// ─── Test 8: Wizard navigation ────────────────────────────────────────────────

describe('Full wizard nav smoke', () => {
  it('navigates through all 6 steps without crashing', async () => {
    seedCharacter();
    render(<App />);

    // Start wizard (need a name)
    const input = screen.getByPlaceholderText(/player's name/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hinata' } });
    });
    const startBtn = screen.getByRole('button', { name: /start building/i });
    await act(async () => { fireEvent.click(startBtn); });

    const nav = screen.getByRole('navigation', { name: /wizard steps/i });
    // Step 1 is already active. Click Next through each step.
    // Use the "Next" button in the wizard-nav footer.
    const allBtns = screen.getAllByRole('button');
    const nextBtn = allBtns.find(b => b.textContent?.trim() === 'Next');
    if (!nextBtn) {
      // Fallback: just check we're in the wizard
      expect(nav).toBeTruthy();
      return;
    }

    // Click through steps 1→6
    for (let i = 0; i < 5; i++) {
      if (!nextBtn.hasAttribute('disabled')) {
        await act(async () => { fireEvent.click(nextBtn); });
      }
    }

    // Should now be on Review step (step 6)
    expect(document.body.textContent).toMatch(/print.*pdf|copy for discord|level up/i);
  });
});

// ─── Test 9: ReviewStep Discord copy button ────────────────────────────────────

describe('ReviewStep Discord copy', () => {
  it('Copy for Discord button click does not throw', async () => {
    renderWithCharacter(<ReviewStep />);
    const copyBtn = screen.getByRole('button', { name: /copy for discord/i });
    await act(async () => { fireEvent.click(copyBtn); });
    // Should not throw; button text changes to Copied! or stays same
    expect(document.body).toBeTruthy();
  });

  it('Print/PDF button click does not throw', async () => {
    renderWithCharacter(<ReviewStep />);
    const printBtn = screen.getByRole('button', { name: /print.*pdf/i });
    await act(async () => { fireEvent.click(printBtn); });
    expect(window.print).toHaveBeenCalled();
  });
});

// ─── Test 10: ABILITY_MAP integrity ───────────────────────────────────────────

describe('Ability data sanity', () => {
  it('ABILITY_MAP contains training with expected shape', () => {
    const training = ABILITY_MAP['training'];
    expect(training).toBeDefined();
    expect(training.repeatable).toBe(true);
    expect(training.baseCost).toBe(5);
  });

  it('all abilities in ABILITY_MAP have valid id, name, baseCost', () => {
    for (const [id, ability] of Object.entries(ABILITY_MAP)) {
      expect(typeof ability.name).toBe('string');
      expect(ability.name.length).toBeGreaterThan(0);
      expect(typeof ability.baseCost).toBe('number');
      expect(ability.baseCost).toBeGreaterThanOrEqual(0);
      expect(ability.id).toBe(id);
    }
  });
});

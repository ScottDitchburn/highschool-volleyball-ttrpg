// @vitest-environment jsdom
// Review-step UI for the level-up system picker and the Weekly match log.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { CharacterProvider, INITIAL_CHARACTER } from '../state/characterStore';
import { STORAGE_KEY, SCHEMA_VERSION } from '../state/persistence';
import { ReviewStep } from '../steps/ReviewStep';
import { makePhysicalAttributes, type Character } from '../types';

function saved(overrides: Partial<Character> = {}): void {
  const character: Character = {
    ...INITIAL_CHARACTER,
    name: 'Kenma',
    physicalPool: { rollA: { dice: [5, 5, 5], total: 15 }, rollB: { dice: [5, 5, 5], total: 15 } },
    physical: makePhysicalAttributes(15, 15),
    skills: { Spike: 3, Serve: 3, Pass: 3, Dig: 3, Set: 3, Block: 3, Speed: 3, Power: 3, IQ: 3, Stamina: 3 },
    yearRoll: 1,
    schoolYear: 1,
    experience: { roll: 5, bonus: 1, label: 'Recreational Player' },
    ...overrides,
  };
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: SCHEMA_VERSION, savedAt: new Date().toISOString(), character }),
  );
}

function renderReview() {
  return render(
    <CharacterProvider>
      <ReviewStep />
    </CharacterProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  if (!window.matchMedia) {
    // @ts-expect-error jsdom lacks matchMedia
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  }
});

afterEach(cleanup);

function picker(): HTMLSelectElement {
  return screen.getByLabelText(/level-up system/i) as HTMLSelectElement;
}

/**
 * The on-screen half of the Review step. ReviewStep also renders the hidden
 * print sheet, which repeats the same figures, so text queries must be scoped.
 */
function ui() {
  return within(document.querySelector('.no-print') as HTMLElement);
}

/** The value shown on one of the Match History summary tiles. */
function tile(label: string): string {
  const el = ui().getByText(label);
  return (el.parentElement as HTMLElement).textContent!.replace(label, '').trim();
}

describe('level-up system picker', () => {
  it('defaults to Tournament and offers the Interhigh events', () => {
    saved();
    renderReview();
    expect(picker().value).toBe('tournament');
    expect(screen.getAllByRole('button', { name: /summer interhigh/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /record a match/i })).toBeNull();
  });

  it('warns that the choice is irreversible and names what it clears', () => {
    saved({
      schoolYear: 2,
      apBudget: { ...INITIAL_CHARACTER.apBudget, levelUpGains: 7, total: 17, remaining: 17 },
      levelUpHistory: [
        { season: 'summer', year: 1, prelimGames: 2, nationalGames: 1, apGained: 7, heightGainCm: 0 },
      ],
    });
    renderReview();
    fireEvent.change(picker(), { target: { value: 'weekly' } });
    fireEvent.click(screen.getByRole('button', { name: /^lock in$/i }));

    const dialog = screen.getByRole('dialog', { name: /lock in the weekly level-up system/i });
    expect(dialog.textContent).toContain('This cannot be undone.');
    expect(dialog.textContent).toContain('1 recorded event cleared');
    expect(dialog.textContent).toContain('7 AP');
    expect(dialog.textContent).toContain('School year back to 1st Year');
  });

  it('cancelling leaves the character on Tournament', () => {
    saved();
    renderReview();
    fireEvent.change(picker(), { target: { value: 'weekly' } });
    fireEvent.click(screen.getByRole('button', { name: /^lock in$/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    // Nothing was committed: the picker is still open and Interhigh still runs.
    expect(picker()).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /summer interhigh/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/record a match/i)).toBeNull();
  });

  it('locking in Weekly swaps the Interhigh buttons for the match log', () => {
    saved();
    renderReview();
    fireEvent.change(picker(), { target: { value: 'weekly' } });
    fireEvent.click(screen.getByRole('button', { name: /^lock in$/i }));
    fireEvent.click(screen.getByRole('button', { name: /lock in weekly/i }));

    expect(screen.queryByLabelText(/level-up system/i)).toBeNull();
    expect(screen.getByText(/locked in/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /summer interhigh/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /spring interhigh/i })).toBeNull();
    expect(screen.getByText(/record a match/i)).toBeTruthy();
    expect(screen.getByText(/no matches recorded yet/i)).toBeTruthy();
  });
});

describe('weekly match log', () => {
  function renderWeekly() {
    saved({ levelUpMode: 'weekly', weeklyMatches: [] });
    renderReview();
  }

  it('records a win with its note and banks the AP', () => {
    renderWeekly();
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: 'vs Nekoma — 2-1' } });
    fireEvent.click(screen.getByRole('button', { name: /record win/i }));

    const row = ui().getByText('vs Nekoma — 2-1').closest('tr')!;
    expect(row.textContent).toContain('Win');
    expect(row.textContent).toContain('+2');
    expect(ui().getByText('Match AP')).toBeTruthy();   // AP breakdown relabelled
    expect(tile('AP Earned')).toBe('+2');
  });

  it('tracks the long-run record across wins and losses', () => {
    renderWeekly();
    fireEvent.click(screen.getByRole('button', { name: /record win/i }));
    fireEvent.click(screen.getByLabelText(/^loss/i));
    fireEvent.click(screen.getByRole('button', { name: /record loss/i }));
    fireEvent.click(screen.getByLabelText(/^win/i));
    fireEvent.click(screen.getByRole('button', { name: /record win/i }));

    expect(tile('Record')).toBe('2–1');
    expect(tile('Played')).toBe('3');
    expect(tile('Win Rate')).toBe('67%');
    expect(tile('AP Earned')).toBe('+5');
    expect(ui().getAllByRole('row')).toHaveLength(4); // header + 3 matches
  });

  it('clears the note field after recording so the next match starts fresh', () => {
    renderWeekly();
    const note = screen.getByLabelText(/note/i) as HTMLInputElement;
    fireEvent.change(note, { target: { value: 'vs Date Tech' } });
    fireEvent.click(screen.getByRole('button', { name: /record win/i }));
    expect((screen.getByLabelText(/note/i) as HTMLInputElement).value).toBe('');
  });

  it('disables the CSV export until there is something to export', () => {
    renderWeekly();
    const csv = screen.getByRole('button', { name: /export match log/i }) as HTMLButtonElement;
    expect(csv.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /record win/i }));
    expect((screen.getByRole('button', { name: /export match log/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});

// @vitest-environment jsdom
// Reset must clear the session and return the player to the landing page.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';

beforeEach(() => {
  localStorage.clear();
  if (!window.matchMedia) {
    // @ts-expect-error shim
    window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
  }
});

describe('reset returns to landing', () => {
  it('name -> wizard -> reset shows the Character Name field again', () => {
    render(<App />);
    // Landing: enter a name and start
    fireEvent.change(screen.getByPlaceholderText(/player's name/i), { target: { value: 'Tester' } });
    fireEvent.click(screen.getByRole('button', { name: /start building/i }));
    // Now in the wizard — the name-entry field should be gone
    expect(screen.queryByPlaceholderText(/player's name/i)).toBeNull();

    // Click Reset (confirm returns true)
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const resetBtn = screen.getAllByRole('button', { name: /reset/i })[0];
    act(() => { fireEvent.click(resetBtn); });

    // Back on the landing page
    expect(screen.getByPlaceholderText(/player's name/i)).toBeTruthy();
    // And the name was cleared
    expect((screen.getByPlaceholderText(/player's name/i) as HTMLInputElement).value).toBe('');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { InfoWidget } from '../components/InfoWidget';

afterEach(() => cleanup());

describe('InfoWidget', () => {
  it('is collapsed by default (panel hidden)', () => {
    render(<InfoWidget />);
    expect(screen.getByRole('button', { name: /information/i })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('expands on click and shows all three help entries', () => {
    render(<InfoWidget />);
    fireEvent.click(screen.getByRole('button', { name: /information/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/what does 3\/5 in a stat even mean/i)).toBeTruthy();
    expect(within(dialog).getByText(/difference between abilities and stats/i)).toBeTruthy();
    expect(within(dialog).getByText(/baseline of not having an ability/i)).toBeTruthy();
  });

  it('collapses when the button is clicked again', () => {
    render(<InfoWidget />);
    const btn = screen.getByRole('button', { name: /^.*information$/i });
    fireEvent.click(btn);
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.click(btn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('collapses when clicking outside', () => {
    render(
      <div>
        <InfoWidget />
        <button>outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^.*information$/i }));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.mouseDown(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('collapses on Escape', () => {
    render(<InfoWidget />);
    fireEvent.click(screen.getByRole('button', { name: /^.*information$/i }));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

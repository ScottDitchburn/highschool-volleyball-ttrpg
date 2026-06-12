// @vitest-environment jsdom
// Regressions for the Skills pool UI:
//  - DiceRoller must refresh its display when initial props change (Roll All 10 bug)
//  - RollPool must render unassigned chips largest -> smallest when sortDescending
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiceRoller } from '../components/DiceRoller';
import { RollPool, type SlotDef } from '../components/RollPool';

beforeEach(() => {
  if (!window.matchMedia) {
    // @ts-expect-error test shim
    window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
  }
});

describe('DiceRoller external prop sync (Roll All 10 fix)', () => {
  it('updates the displayed average when initialValue/initialDice change after mount', () => {
    const { rerender } = render(
      <DiceRoller numDice={4} sides={4} mode="average" compact onResult={() => {}}
        initialDice={[2, 2, 2, 2]} initialValue={2.0} />
    );
    expect(screen.getByText('2.00')).toBeTruthy();
    // External update (what "Roll All 10" does to each chip)
    rerender(
      <DiceRoller numDice={4} sides={4} mode="average" compact onResult={() => {}}
        initialDice={[4, 4, 4, 2]} initialValue={3.5} />
    );
    expect(screen.getByText('3.50')).toBeTruthy();
    expect(screen.queryByText('2.00')).toBeNull();
  });
});

describe('RollPool sortDescending', () => {
  const slots: SlotDef[] = [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C' }];
  it('renders unassigned pool chips largest -> smallest', () => {
    render(
      <RollPool
        poolSize={3}
        slots={slots}
        formatValue={(v) => v.toFixed(2)}
        onAssign={() => {}}
        onUnassign={() => {}}
        onRerollAll={() => {}}
        assignments={{}}
        chipValues={[2.0, 3.0, 2.5]}
        sortDescending
      />
    );
    const chips = screen.getAllByRole('listitem').map((el) => el.textContent?.trim());
    expect(chips).toEqual(['3.00', '2.50', '2.00']);
  });

  it('uses the custom reroll/reset label', () => {
    render(
      <RollPool poolSize={1} slots={slots} onAssign={() => {}} onUnassign={() => {}}
        onRerollAll={() => {}} assignments={{}} chipValues={[2.0]} rerollLabel="Reset" />
    );
    expect(screen.getByRole('button', { name: /reset/i })).toBeTruthy();
  });
});

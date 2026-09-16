// @vitest-environment jsdom
// src/__tests__/verticalModifierUi.test.tsx
// The v.3 Height → Vert Jump Modifier must be visible wherever the vertical jump
// is shown, and the maths must be spelled out on the Physical step.
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { CharacterProvider, computeDerived } from '../state/characterStore';
import { STORAGE_KEY, SCHEMA_VERSION } from '../state/persistence';
import { PhysicalStep } from '../steps/PhysicalStep';
import { ReachesStep } from '../steps/ReachesStep';
import { buildDiscordExport } from '../export/discord';
import { INITIAL_CHARACTER } from '../state/characterStore';
import { makePhysicalAttributes, type Character } from '../types';

// Height roll 22 → 192 cm and a −9 vert modifier; raw vertical roll 18 → 9 → 66 cm.
const CHAR: Character = {
  ...INITIAL_CHARACTER,
  name: 'Modifier Tester',
  physicalPool: {
    rollA: { dice: [8, 7, 7], total: 22 },
    rollB: { dice: [6, 6, 6], total: 18 },
  },
  physical: makePhysicalAttributes(22, 18),
};

function renderWith(ui: React.ReactElement, char: Character = CHAR) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: SCHEMA_VERSION, savedAt: new Date().toISOString(), character: char }),
  );
  return render(<CharacterProvider>{ui}</CharacterProvider>);
}

describe('PhysicalStep shows the v.3 modifier maths', () => {
  beforeEach(() => localStorage.clear());

  it('spells out the height → modifier lookup', () => {
    renderWith(<PhysicalStep />);
    expect(screen.getByText(/Roll 22 -> 192 cm, vert modifier/)).toBeInTheDocument();
    expect(screen.getByText('-9')).toBeInTheDocument();
  });

  it('spells out the vertical jump arithmetic (roll − mod = effective → cm)', () => {
    renderWith(<PhysicalStep />);
    expect(screen.getAllByText(/Roll 18 -9 = 9\s*->\s*66 cm/).length).toBeGreaterThan(0);
  });

  it('labels the vertical chart as conditional on the assigned height roll', () => {
    renderWith(<PhysicalStep />);
    expect(
      screen.getAllByText(/Vertical Jump Distribution \(cm\) -- given Height roll 22 \(modifier -9\)/).length,
    ).toBeGreaterThan(0);
  });

  it('notes the modifier in the Vertical Jump slot sublabel', () => {
    renderWith(<PhysicalStep />);
    expect(screen.getAllByText('((3d10 + height mod) x 3 + 39 cm)').length).toBeGreaterThan(0);
  });
});

describe('ReachesStep shows the modifier alongside the vertical', () => {
  beforeEach(() => localStorage.clear());

  it('reports the modified vertical and its modifier', () => {
    renderWith(<ReachesStep />);
    expect(screen.getByText(/Vertical Jump \(66 cm, mod -9\)/)).toBeInTheDocument();
  });
});

describe('Discord export', () => {
  it('lists the vertical jump with its modifier', () => {
    const text = buildDiscordExport(CHAR, null, computeDerived(CHAR));
    expect(text).toMatch(/Vertical Jump: 66 cm .*\(mod -9\)/);
  });
});

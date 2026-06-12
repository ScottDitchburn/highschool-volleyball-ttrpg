// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PrintSheet } from '../export/PrintSheet';
import { INITIAL_CHARACTER } from '../state/characterStore';
import type { Character, SkillStats } from '../types';

const skills: SkillStats = {
  Spike: 3.5, Serve: 2.0, Pass: 2.75, Dig: 1.5, Set: 3.0,
  Block: 2.25, Speed: 3.75, Power: 3.0, IQ: 3.0, Stamina: 2.5,
};
const character: Character = { ...INITIAL_CHARACTER, name: 'Printy', skills };

describe('Print sheet radar', () => {
  it('includes the skill radar under the skill stats', () => {
    const { getByRole } = render(<PrintSheet character={character} effectiveStats={skills} derived={null} />);
    expect(getByRole('img', { name: /skill stats radar/i })).toBeTruthy();
  });
});

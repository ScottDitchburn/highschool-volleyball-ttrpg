// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SkillRadar } from '../charts/SkillRadar';
import { SKILL_STAT_NAMES, type SkillStats } from '../types';

const stats: SkillStats = {
  Spike: 3.5, Serve: 2.0, Pass: 2.75, Dig: 1.5, Set: 3.0,
  Block: 2.25, Speed: 3.75, Power: 4.25, IQ: 3.0, Stamina: 2.5,
};

describe('SkillRadar', () => {
  it('renders all ten skill labels and a data polygon', () => {
    const { container } = render(<SkillRadar stats={stats} />);
    for (const name of SKILL_STAT_NAMES) {
      expect(container.textContent).toContain(name);
    }
    // filled data polygon present
    const polys = container.querySelectorAll('polygon[fill="#E8741E"]');
    expect(polys.length).toBe(1);
    // scale expanded past 4 because Power is 4.25 -> maxScale 5 -> 5 ring polygons
    const ringPolys = container.querySelectorAll('polygon[fill="none"]');
    expect(ringPolys.length).toBe(5);
  });
});

import { describe, it, expect } from 'vitest';
import { cmToImperial, cmDual } from '../utils/units';

describe('cm -> imperial', () => {
  it('converts known heights', () => {
    expect(cmToImperial(154)).toBe("5'1\"");
    expect(cmToImperial(208)).toBe("6'10\"");
    expect(cmToImperial(273)).toBe("8'11\"");
  });
  it('carries 12 inches up to a foot', () => {
    expect(cmToImperial(182)).toBe("6'0\""); // 71.65in rounds to 72 -> 6'0"
  });
  it('cmDual shows metric then imperial', () => {
    expect(cmDual(252.2)).toMatch(/^252\.2 cm \/ \d+'\d+"$/);
    expect(cmDual(81, 0)).toBe("81 cm / 2'8\"");
  });
});

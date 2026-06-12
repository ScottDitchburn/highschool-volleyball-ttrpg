/** Convert 1–5 to Roman numeral string; fallback to numeric string. */
export function toRomanNumeral(n: number): string {
  const map: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  return map[n] ?? String(n);
}

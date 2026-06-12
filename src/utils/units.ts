// Unit helpers: convert cm to imperial feet/inches for dual display.

/** cm -> imperial string like 5'11" (whole inches, carries 12" up to a foot). */
export function cmToImperial(cm: number): string {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return `${ft}'${inch}"`;
}

/** "182.0 cm / 5'11"" — metric with imperial alongside. */
export function cmDual(cm: number, decimals = 1): string {
  return `${cm.toFixed(decimals)} cm / ${cmToImperial(cm)}`;
}

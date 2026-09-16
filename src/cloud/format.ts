// Small presentation helpers for the cloud panels (kept out of the component
// files so they stay component-only for react-refresh).

/** "3rd Year" / "Graduate" / "—" from a summary row. */
export function yearBadge(schoolYear: number | null, graduated: boolean): string {
  if (graduated) return 'Graduate';
  if (schoolYear === 1) return '1st Year';
  if (schoolYear === 2) return '2nd Year';
  if (schoolYear === 3) return '3rd Year';
  return '—';
}

/** Short local date for an ISO timestamp; '' when there isn't one. */
export function shortDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

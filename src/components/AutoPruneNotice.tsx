// AutoPruneNotice -- app-level toast shown when the validation sweep
// auto-removes abilities whose prereqs are no longer met (e.g. after the
// player reassigns stats on the Skills step). Informational + dismissible;
// the removal has already happened by the time this appears.

import { useEffect, useRef, useState } from 'react';
import type { IneligibleAbility } from '../engine/prereqEngine';

const AUTO_DISMISS_MS = 8000;

export function AutoPruneNotice() {
  const [removed, setRemoved] = useState<IneligibleAbility[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ removed: IneligibleAbility[] }>).detail;
      if (!detail?.removed?.length) return;
      setRemoved(detail.removed);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setRemoved(null), AUTO_DISMISS_MS);
    };
    window.addEventListener('haikyu:abilities-pruned', handler);
    return () => {
      window.removeEventListener('haikyu:abilities-pruned', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!removed) return null;

  return (
    <div
      className="no-print fixed bottom-4 right-4 z-[60] max-w-sm w-[calc(100%-2rem)] sm:w-full"
      role="alert"
      aria-live="assertive"
    >
      <div className="card border-amber-600 flex flex-col gap-2 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold text-amber-400">
            {removed.length === 1 ? 'Ability removed' : `${removed.length} abilities removed`}
          </h3>
          <button
            onClick={() => setRemoved(null)}
            className="text-charcoal-400 hover:text-amber-400 text-xs leading-none"
            aria-label="Dismiss notice"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-charcoal-400">
          Your changes left these abilities no longer eligible, so they were deselected:
        </p>
        <ul className="flex flex-col gap-1.5">
          {removed.map((d) => (
            <li key={d.uid} className="bg-charcoal-800 rounded-md p-2 flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-charcoal-100">{d.name}</span>
              <span className="text-[0.7rem] text-amber-400">{d.reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

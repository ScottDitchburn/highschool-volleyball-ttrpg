// Coach / Team Management screen. Reached via the "Coach" button on the start
// screen or the /Coach URL. Self-contained: its own provider + localStorage.

import { useMemo, useState } from 'react';
import { CoachProvider, useCoach, benchPlayers, duplicateNumbers } from './coachStore';
import { RosterImporter } from './RosterImporter';
import { RosterList } from './RosterList';
import { LineupGrid } from './LineupGrid';
import { CoachControls } from './CoachControls';
import { CoachPrintSheet } from './export/CoachPrintSheet';

interface Props {
  onExit: () => void;
}

function Warnings() {
  const { coach } = useCoach();
  const issues = useMemo(() => {
    const out: string[] = [];
    const dups = duplicateNumbers(coach);
    if (dups.size > 0) {
      out.push(`Duplicate jersey number${dups.size > 1 ? 's' : ''}: ${[...dups].sort((a, b) => a - b).join(', ')}.`);
    }
    const bench = new Set(benchPlayers(coach).map((p) => p.id));
    const placedMissing = coach.roster.filter(
      (p) => !bench.has(p.id) && (p.number === null || p.position === null)
    );
    if (placedMissing.length > 0) {
      out.push(`${placedMissing.length} player(s) in the lineup are missing a number or position.`);
    }
    return out;
  }, [coach]);

  if (issues.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-700/60 bg-amber-900/20 px-3 py-2 text-amber-300 text-sm">
      <ul className="list-disc list-inside flex flex-col gap-0.5">
        {issues.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function CoachScreen({ onExit }: Props) {
  const { coach } = useCoach();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      {/* Print-only team sheet (hidden on screen, shown in @media print) */}
      <div className="print-only" aria-hidden="true">
        <CoachPrintSheet coach={coach} />
      </div>

      <div className="no-print flex flex-col min-h-screen bg-court">
        {/* Top bar */}
        <header className="bg-charcoal-950 border-b border-charcoal-800 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-orange-400 font-black text-lg tracking-tight">Coach</span>
            <span className="text-charcoal-500 text-sm ml-2">Team Management</span>
          </div>
          <button onClick={onExit} className="btn-ghost text-sm py-1.5 px-3" title="Back to character builder">
            ← Builder
          </button>
        </header>

        <div className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-5">
          <CoachControls />
          <Warnings />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: roster import + list */}
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-charcoal-500">
                Roster ({coach.roster.length} / 12)
              </h2>
              <RosterImporter />
              <RosterList selectedId={selectedId} onSelect={setSelectedId} />
            </section>

            {/* Right: lineup grid */}
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-charcoal-500">Starting Lineup</h2>
              <LineupGrid selectedId={selectedId} onSelect={setSelectedId} />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

export function CoachApp({ onExit }: Props) {
  return (
    <CoachProvider>
      <CoachScreen onExit={onExit} />
    </CoachProvider>
  );
}

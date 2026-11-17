// src/components/WeeklyMatchPanel.tsx
// Review-step panel for the Weekly level-up system: record a match (Win +2 AP /
// Loss +1 AP with a free-text reference note), see the long-run record, and read
// or export the append-only audit trail.

import { useCallback, useState } from 'react';
import { useCharacter } from '../state/characterStore';
import {
  MATCH_RESULT_LABEL,
  WEEKLY_MATCH_AP,
  summariseWeeklyMatches,
  weeklyMatchesOf,
  type MatchResult,
} from '../types';
import { downloadWeeklyMatchCsv } from '../export/weeklyCsv';

const NOTE_MAX = 200;
const RESULTS: MatchResult[] = ['win', 'loss'];

/** "17 Nov 2026" — blank for a record with no usable timestamp. */
function recordedLabel(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-charcoal-800 rounded-lg px-3 py-2.5 flex flex-col">
      <span className="text-charcoal-500 text-xs uppercase tracking-wider">{label}</span>
      <span className={`font-mono font-black text-lg ${accent ? 'text-orange-400' : 'text-charcoal-100'}`}>
        {value}
      </span>
    </div>
  );
}

export function WeeklyMatchPanel() {
  const { character, dispatch } = useCharacter();
  const matches = weeklyMatchesOf(character);
  const summary = summariseWeeklyMatches(matches);

  const [result, setResult] = useState<MatchResult>('win');
  const [note, setNote] = useState('');

  const recordMatch = useCallback(() => {
    dispatch({ type: 'RECORD_WEEKLY_MATCH', result, note });
    setNote('');
    setResult('win');
  }, [dispatch, result, note]);

  const handleCsv = useCallback(() => {
    downloadWeeklyMatchCsv(character);
  }, [character]);

  let runningAp = 0;
  const rows = matches.map((match, i) => {
    runningAp += match.apGained;
    return { match, number: i + 1, runningAp };
  });

  return (
    <div className="flex flex-col gap-4">
      {/* ── Record a match ── */}
      <div className="card flex flex-col gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-500">
            Record a Match
          </h3>
          <p className="text-charcoal-400 text-sm mt-1">
            A win banks {WEEKLY_MATCH_AP.win} AP, a loss {WEEKLY_MATCH_AP.loss} AP. The note is
            yours — it is never read by the builder.
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-charcoal-300 mb-1">Result</legend>
          <div className="flex gap-2 flex-wrap">
            {RESULTS.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm font-bold transition-colors ${
                  result === r
                    ? 'bg-orange-700 border-orange-500 text-white'
                    : 'bg-charcoal-800 border-charcoal-700 text-charcoal-300 hover:border-charcoal-500'
                }`}
              >
                <input
                  type="radio"
                  name="match-result"
                  value={r}
                  checked={result === r}
                  onChange={() => setResult(r)}
                  className="accent-orange-500"
                />
                {MATCH_RESULT_LABEL[r]} (+{WEEKLY_MATCH_AP[r]} AP)
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="match-note" className="text-sm font-semibold text-charcoal-300">
            Note <span className="text-charcoal-500 font-normal">(optional)</span>
          </label>
          <input
            id="match-note"
            type="text"
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') recordMatch();
            }}
            placeholder="e.g. vs Nekoma — 2-1, 14 kills, served out the 3rd set"
            className="bg-charcoal-800 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:outline-none focus:border-orange-500"
          />
          <span className="text-charcoal-600 text-xs self-end">
            {note.length}/{NOTE_MAX}
          </span>
        </div>

        <button onClick={recordMatch} className="btn-primary self-start">
          Record {MATCH_RESULT_LABEL[result]} (+{WEEKLY_MATCH_AP[result]} AP)
        </button>
      </div>

      {/* ── Long-run record + audit trail ── */}
      <div className="card flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-500">
            Match History
          </h3>
          <button
            onClick={handleCsv}
            disabled={matches.length === 0}
            className="btn-ghost text-sm py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download the match log as a CSV file"
          >
            Export Match Log (CSV)
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryTile label="Record" value={`${summary.wins}–${summary.losses}`} />
          <SummaryTile label="Played" value={String(summary.played)} />
          <SummaryTile label="Win Rate" value={`${Math.round(summary.winRate * 100)}%`} />
          <SummaryTile label="AP Earned" value={`+${summary.apGained}`} accent />
        </div>

        {matches.length === 0 ? (
          <p className="text-charcoal-500 italic text-sm text-center py-4">
            No matches recorded yet — log your first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">Weekly match log</caption>
              <thead>
                <tr className="text-charcoal-500 text-xs uppercase tracking-wider">
                  <th scope="col" className="text-left font-semibold py-1.5 pr-2">#</th>
                  <th scope="col" className="text-left font-semibold py-1.5 pr-2">Result</th>
                  <th scope="col" className="text-right font-semibold py-1.5 pr-2">AP</th>
                  <th scope="col" className="text-right font-semibold py-1.5 pr-4">Total AP</th>
                  <th scope="col" className="text-left font-semibold py-1.5 pr-4">Recorded</th>
                  <th scope="col" className="text-left font-semibold py-1.5">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ match, number, runningAp: total }) => (
                  <tr key={match.uid} className="border-t border-charcoal-800">
                    <td className="py-1.5 pr-2 font-mono text-charcoal-500">{number}</td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={`font-bold ${
                          match.result === 'win' ? 'text-green-400' : 'text-charcoal-400'
                        }`}
                      >
                        {MATCH_RESULT_LABEL[match.result]}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-right text-orange-400">
                      +{match.apGained}
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-right text-charcoal-400">{total}</td>
                    <td className="py-1.5 pr-4 text-charcoal-400 whitespace-nowrap">
                      {recordedLabel(match.recordedAt)}
                    </td>
                    <td className="py-1.5 text-charcoal-300">{match.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

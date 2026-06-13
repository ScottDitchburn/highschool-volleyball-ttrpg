// Roster list — one row per imported player: drag/tap handle, name + key stats,
// jersey number (0–99), position dropdown (abbr shown, full name on hover), remove.
// Duplicate numbers / missing fields warn but never block.

import { useMemo } from 'react';
import { useCoach, duplicateNumbers } from './coachStore';
import { POSITIONS, POSITION_FULL, type Position, type RosterPlayer } from './types';
import { deriveForPlayer } from './playerStats';
import { cmDual } from '../utils/units';

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function RosterList({ selectedId, onSelect }: Props) {
  const { coach, dispatch } = useCoach();
  const dups = useMemo(() => duplicateNumbers(coach), [coach]);

  if (coach.roster.length === 0) {
    return (
      <p className="text-charcoal-500 text-sm italic py-4 text-center">
        No players yet — import character JSON files above to build your roster.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {coach.roster.map((player) => (
        <RosterRow
          key={player.id}
          player={player}
          duplicate={player.number !== null && dups.has(player.number)}
          selected={selectedId === player.id}
          onSelect={onSelect}
          onNumber={(n) => dispatch({ type: 'SET_NUMBER', id: player.id, number: n })}
          onPosition={(p) => dispatch({ type: 'SET_POSITION', id: player.id, position: p })}
          onRemove={() => {
            if (selectedId === player.id) onSelect(null);
            dispatch({ type: 'REMOVE_PLAYER', id: player.id });
          }}
        />
      ))}
    </ul>
  );
}

interface RowProps {
  player: RosterPlayer;
  duplicate: boolean;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onNumber: (n: number | null) => void;
  onPosition: (p: Position | null) => void;
  onRemove: () => void;
}

function RosterRow({ player, duplicate, selected, onSelect, onNumber, onPosition, onRemove }: RowProps) {
  const derived = useMemo(() => deriveForPlayer(player.character), [player.character]);
  const name = player.character.name || 'Unnamed Player';
  const heightStr = derived.effectiveHeightCm !== null ? cmDual(derived.effectiveHeightCm) : '—';

  // top 3 stats for a quick at-a-glance summary
  const topStats = derived.effectiveStats
    ? Object.entries(derived.effectiveStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([s, v]) => `${s} ${v.toFixed(1)}`)
        .join(' · ')
    : 'stats not assigned';

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', player.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onSelect(selected ? null : player.id)}
      className={[
        'card flex items-center gap-3 cursor-grab active:cursor-grabbing transition-colors',
        selected ? 'ring-2 ring-orange-500 border-orange-600' : 'hover:border-charcoal-600',
      ].join(' ')}
    >
      <span className="text-charcoal-600 select-none" aria-hidden="true">
        ⠿
      </span>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-charcoal-100 truncate">{name}</div>
        <div className="text-charcoal-500 text-xs truncate">
          {heightStr} · {topStats}
        </div>
      </div>

      {/* Jersey number */}
      <label className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <span className="sr-only">Jersey number for {name}</span>
        <input
          type="number"
          min={0}
          max={99}
          value={player.number ?? ''}
          placeholder="#"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onNumber(null);
            const n = Math.max(0, Math.min(99, Math.floor(Number(raw))));
            onNumber(Number.isNaN(n) ? null : n);
          }}
          className={[
            'w-14 text-center bg-charcoal-800 border rounded-lg px-2 py-1.5 text-charcoal-100',
            'focus:outline-none focus:ring-1',
            duplicate
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-charcoal-600 focus:border-orange-600 focus:ring-orange-600',
          ].join(' ')}
          title={duplicate ? 'Duplicate jersey number' : undefined}
        />
      </label>

      {/* Position */}
      <div onClick={(e) => e.stopPropagation()}>
        <label className="sr-only" htmlFor={`pos-${player.id}`}>
          Position for {name}
        </label>
        <select
          id={`pos-${player.id}`}
          value={player.position ?? ''}
          onChange={(e) => onPosition((e.target.value || null) as Position | null)}
          title={player.position ? POSITION_FULL[player.position] : 'Select a position'}
          className="bg-charcoal-800 border border-charcoal-600 rounded-lg px-2 py-1.5 text-charcoal-100
                     focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600"
        >
          <option value="">—</option>
          {POSITIONS.map((p) => (
            <option key={p.abbr} value={p.abbr} title={p.full}>
              {p.abbr}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-charcoal-500 hover:text-red-400 text-lg leading-none px-1"
        aria-label={`Remove ${name} from roster`}
        title="Remove from roster"
      >
        ×
      </button>
    </li>
  );
}

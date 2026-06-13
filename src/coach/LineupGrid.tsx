// Interactive starting-lineup grid (on-screen, dark theme).
// Layout mirrors the printed line-up sheet:
//   IV  III  II
//   V   VI   I (service)
// plus a LIBERO box and a TEAM name field.
// Placement: drag a roster player onto a slot (desktop) OR select a player then
// tap a slot (mobile). Each slot has a clear (×) control.

import { useCallback, useState } from 'react';
import { useCoach } from './coachStore';
import {
  COURT_LAYOUT,
  POSITION_FULL,
  type CourtSlot,
  type LineupTarget,
  type RosterPlayer,
} from './types';

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function LineupGrid({ selectedId, onSelect }: Props) {
  const { coach, dispatch } = useCoach();

  const byId = useCallback(
    (id: string | null): RosterPlayer | null => (id ? coach.roster.find((p) => p.id === id) ?? null : null),
    [coach.roster]
  );

  const place = useCallback(
    (target: LineupTarget, playerId: string) => {
      dispatch({ type: 'PLACE', playerId, target });
    },
    [dispatch]
  );

  // Tap behaviour: place selection, else select an occupant, else nothing.
  const handleSlotTap = useCallback(
    (target: LineupTarget, occupantId: string | null) => {
      if (selectedId) {
        place(target, selectedId);
        onSelect(null);
      } else if (occupantId) {
        onSelect(occupantId);
      }
    },
    [selectedId, place, onSelect]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header: team name + LIBERO */}
      <div className="flex items-stretch gap-3">
        <div className="flex-1 card flex flex-col justify-center py-2">
          <div className="text-orange-400 font-black tracking-widest text-sm">LINE-UP</div>
          <label className="flex items-center gap-2 mt-1">
            <span className="text-charcoal-500 text-xs uppercase tracking-wide">Team</span>
            <input
              type="text"
              value={coach.teamName}
              onChange={(e) => dispatch({ type: 'SET_TEAM_NAME', name: e.target.value })}
              placeholder="Team name…"
              maxLength={48}
              className="flex-1 bg-charcoal-800 border border-charcoal-600 rounded-lg px-3 py-1.5
                         text-charcoal-100 placeholder:text-charcoal-600 focus:outline-none
                         focus:border-orange-600 focus:ring-1 focus:ring-orange-600"
            />
          </label>
        </div>

        <LiberoBox
          player={byId(coach.lineup.libero)}
          selectedId={selectedId}
          onDrop={(playerId) => place({ kind: 'libero' }, playerId)}
          onTap={() => handleSlotTap({ kind: 'libero' }, coach.lineup.libero)}
          onClear={() => dispatch({ type: 'CLEAR_TARGET', target: { kind: 'libero' } })}
        />
      </div>

      <p className="text-charcoal-500 text-xs">
        Drag a player from the roster into a slot, or tap a player then tap a slot.
      </p>

      {/* Court grid */}
      <div className="flex flex-col gap-3">
        {COURT_LAYOUT.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-3">
            {row.map((slot) => (
              <SlotBox
                key={slot}
                slot={slot}
                player={byId(coach.lineup.slots[slot])}
                selectable={selectedId !== null}
                onDrop={(playerId) => place({ kind: 'slot', slot }, playerId)}
                onTap={() => handleSlotTap({ kind: 'slot', slot }, coach.lineup.slots[slot])}
                onClear={() => dispatch({ type: 'CLEAR_TARGET', target: { kind: 'slot', slot } })}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Generic drop/tap slot ──────────────────────────────────────────────────────

interface SlotBoxProps {
  slot: CourtSlot;
  player: RosterPlayer | null;
  selectable: boolean;
  onDrop: (playerId: string) => void;
  onTap: () => void;
  onClear: () => void;
}

function SlotBox({ slot, player, selectable, onDrop, onTap, onClear }: SlotBoxProps) {
  const [over, setOver] = useState(false);
  const isService = slot === 'I';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Slot ${slot}${player ? `: ${player.character.name || 'Unnamed'}` : ' (empty)'}`}
      draggable={!!player}
      onDragStart={(e) => {
        if (!player) return;
        e.dataTransfer.setData('text/plain', player.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDrop(id);
      }}
      className={[
        'relative aspect-[4/3] rounded-lg border-2 p-2 flex flex-col transition-colors',
        player ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        over
          ? 'border-orange-500 bg-orange-500/10'
          : player
            ? 'border-charcoal-500 bg-charcoal-800'
            : selectable
              ? 'border-dashed border-orange-700/60 bg-charcoal-900 hover:border-orange-600'
              : 'border-dashed border-charcoal-700 bg-charcoal-900 hover:border-charcoal-500',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="text-orange-400 font-black text-sm leading-none">{slot}</span>
        {isService && <span className="text-charcoal-500 text-[10px] uppercase tracking-wide">Service</span>}
      </div>

      {player ? (
        <PlacedPlayer player={player} onClear={onClear} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-charcoal-700 text-xs select-none">
          empty
        </div>
      )}
    </div>
  );
}

// ── Libero box (visually distinct) ─────────────────────────────────────────────

interface LiberoBoxProps {
  player: RosterPlayer | null;
  selectedId: string | null;
  onDrop: (playerId: string) => void;
  onTap: () => void;
  onClear: () => void;
}

function LiberoBox({ player, selectedId, onDrop, onTap, onClear }: LiberoBoxProps) {
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Libero${player ? `: ${player.character.name || 'Unnamed'}` : ' (empty)'}`}
      draggable={!!player}
      onDragStart={(e) => {
        if (!player) return;
        e.dataTransfer.setData('text/plain', player.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDrop(id);
      }}
      className={[
        'w-32 rounded-lg border-2 p-2 flex flex-col transition-colors',
        player ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        over
          ? 'border-orange-500 bg-orange-500/10'
          : player
            ? 'border-orange-600 bg-charcoal-800'
            : selectedId
              ? 'border-dashed border-orange-700/60 bg-charcoal-900 hover:border-orange-600'
              : 'border-dashed border-charcoal-700 bg-charcoal-900 hover:border-charcoal-500',
      ].join(' ')}
    >
      <span className="text-orange-400 font-black text-xs tracking-widest">LIBERO</span>
      {player ? (
        <PlacedPlayer player={player} onClear={onClear} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-charcoal-700 text-xs select-none py-2">
          empty
        </div>
      )}
    </div>
  );
}

// ── Placed-player chip inside a slot ───────────────────────────────────────────

function PlacedPlayer({ player, onClear }: { player: RosterPlayer; onClear: () => void }) {
  const name = player.character.name || 'Unnamed';
  return (
    <div className="flex-1 flex flex-col justify-center min-w-0">
      <div className="flex items-baseline gap-1.5">
        <span className="text-charcoal-100 font-black text-lg leading-none">
          {player.number ?? '—'}
        </span>
        {player.position && (
          <span className="text-orange-400 text-xs font-bold" title={POSITION_FULL[player.position]}>
            {player.position}
          </span>
        )}
      </div>
      <div className="text-charcoal-300 text-xs truncate">{name}</div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="absolute top-1 right-1 text-charcoal-500 hover:text-red-400 text-sm leading-none"
        aria-label={`Remove ${name} from this slot`}
        title="Clear slot"
      >
        ×
      </button>
    </div>
  );
}

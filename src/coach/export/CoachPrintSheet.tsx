// Print / PDF sheet for a coach team. Clean black-on-white, mirrors the printed
// line-up sheet: lineup grid + libero at the top, full roster table at the bottom.
// Rendered inside a `.print-only` wrapper; window.print() turns it into PDF.

import { Fragment } from 'react';
import type { CoachState, RosterPlayer, CourtSlot } from '../types';
import { COURT_LAYOUT, POSITION_FULL } from '../types';
import { SKILL_STAT_NAMES } from '../../types';
import { deriveForPlayer } from '../playerStats';
import { abilityLabels } from '../abilityLabels';
import { cmDual } from '../../utils/units';

const INK = '#111';
const LINE = '#444';
const MUTED = '#666';

interface Props {
  coach: CoachState;
}

function findPlayer(coach: CoachState, id: string | null): RosterPlayer | null {
  return id ? coach.roster.find((p) => p.id === id) ?? null : null;
}

function SlotCell({ slot, player }: { slot: CourtSlot; player: RosterPlayer | null }) {
  return (
    <div
      style={{
        border: `1.5px solid ${INK}`,
        borderRadius: 4,
        minHeight: 78,
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 900, fontSize: 14 }}>{slot}</span>
        {slot === 'I' && <span style={{ fontSize: 9, color: MUTED, letterSpacing: 0.5 }}>SERVICE</span>}
      </div>
      {player ? (
        <div style={{ marginTop: 'auto' }}>
          <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>
            {player.number ?? '—'}
            {player.position && (
              <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 5, color: MUTED }}>
                {player.position}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11 }}>{player.character.name || 'Unnamed'}</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 10 }}>
          —
        </div>
      )}
    </div>
  );
}

export function CoachPrintSheet({ coach }: Props) {
  const libero = findPlayer(coach, coach.lineup.libero);

  return (
    <div
      id="coach-print-sheet"
      style={{
        fontFamily: 'Inter, Arial, sans-serif',
        color: INK,
        background: '#fff',
        padding: '20px 28px',
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `3px solid ${INK}`, paddingBottom: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: MUTED, fontWeight: 700 }}>SET 1 — LINE-UP SHEET</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 900 }}>{coach.teamName || 'Unnamed Team'}</h1>
        </div>
        <div style={{ border: `1.5px solid ${INK}`, borderRadius: 4, padding: '4px 10px', minWidth: 130, textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }}>LIBERO</div>
          <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>
            {libero ? (libero.number ?? '—') : '—'}
          </div>
          <div style={{ fontSize: 10 }}>{libero ? libero.character.name || 'Unnamed' : ''}</div>
        </div>
      </div>

      {/* Lineup grid */}
      {COURT_LAYOUT.map((row, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
          {row.map((slot) => (
            <SlotCell key={slot} slot={slot} player={findPlayer(coach, coach.lineup.slots[slot])} />
          ))}
        </div>
      ))}

      {/* Roster table */}
      <h2 style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1, margin: '18px 0 6px', textTransform: 'uppercase' }}>
        Roster ({coach.roster.length})
      </h2>
      {coach.roster.length === 0 ? (
        <p style={{ color: MUTED, fontStyle: 'italic' }}>No players imported.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr>
              {['#', 'Pos', 'Name', 'Ht', ...SKILL_STAT_NAMES].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === 'Name' || h === 'Pos' ? 'left' : 'center',
                    borderBottom: `1.5px solid ${INK}`,
                    padding: '3px 4px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coach.roster.map((p) => {
              const d = deriveForPlayer(p.character);
              const abilities = abilityLabels(p.character);
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 700 }}>{p.number ?? '—'}</td>
                    <td style={{ padding: '3px 4px' }} title={p.position ? POSITION_FULL[p.position] : undefined}>
                      {p.position ?? '—'}
                    </td>
                    <td style={{ padding: '3px 4px', whiteSpace: 'nowrap' }}>{p.character.name || 'Unnamed'}</td>
                    <td style={{ textAlign: 'center', padding: '3px 4px', whiteSpace: 'nowrap' }}>
                      {d.effectiveHeightCm !== null ? cmDual(d.effectiveHeightCm) : '—'}
                    </td>
                    {SKILL_STAT_NAMES.map((s) => (
                      <td key={s} style={{ textAlign: 'center', padding: '3px 4px' }}>
                        {d.effectiveStats ? d.effectiveStats[s].toFixed(1) : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td />
                    <td
                      colSpan={3 + SKILL_STAT_NAMES.length}
                      style={{
                        borderBottom: `1px solid ${LINE}`,
                        padding: '0 4px 5px',
                        fontSize: 9,
                        color: MUTED,
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>Abilities: </span>
                      {abilities.length > 0 ? abilities.join(' · ') : 'none'}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// src/export/PrintSheet.tsx
// A print-optimized one-page character sheet.
// Shown inside a <div class="print-only"> that is hidden on screen but visible in @media print.
// The "Print / Save as PDF" button in ReviewStep calls window.print().


import type { Character, SkillStats, DerivedReaches } from '../types';
import { SKILL_STAT_NAMES } from '../types';
import { ABILITY_MAP } from '../data/abilities';
import { computeAPBudget } from '../engine/apEngine';

interface Props {
  character: Character;
  effectiveStats: SkillStats | null;
  derived: DerivedReaches | null;
}

function toRoman(n: number): string {
  const map: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  return map[n] ?? String(n);
}

function yearLabel(y: number): string {
  if (y === 1) return '1st Year';
  if (y === 2) return '2nd Year';
  return '3rd Year';
}

export function PrintSheet({ character, effectiveStats, derived }: Props) {
  const { name, schoolYear, physical, selectedAbilities, levelUpHistory } = character;
  const apBudget = computeAPBudget(character); // live spent/remaining

  return (
    <div
      id="print-sheet"
      style={{
        fontFamily: 'Inter, Arial, sans-serif',
        color: '#111',
        background: '#fff',
        padding: '20px 28px',
        maxWidth: '720px',
        margin: '0 auto',
        fontSize: '13px',
        lineHeight: 1.45,
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: '3px solid #E8741E', paddingBottom: '10px', marginBottom: '14px' }}>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 900, color: '#E8741E', letterSpacing: '-0.5px' }}>
          {name || 'Unnamed Player'}
        </h1>
        <div style={{ color: '#555', fontSize: '14px', marginTop: '2px' }}>
          Haikyuu: Gauntlet RPG v2 — {yearLabel(schoolYear)}
        </div>
        {character.seeded && character.seed && (
          <div style={{ color: '#888', fontSize: '11px', marginTop: '3px' }}>
            🔒 Seeded run · seed: <span style={{ fontFamily: 'monospace', color: '#555' }}>{character.seed}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Physical */}
          <section>
            <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '6px' }}>
              Physical Attributes
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#555', paddingBottom: '3px', width: '50%' }}>Height</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}>
                    {physical ? `${physical.heightCm.toFixed(1)} cm` : '—'}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#555', paddingBottom: '3px' }}>Vertical Jump</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}>
                    {physical ? `${physical.verticalCm} cm` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Reaches */}
          <section>
            <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '6px' }}>
              Derived Reaches
            </h2>
            {derived ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Standing Reach', derived.standingReachCm],
                    ['Spiking Reach',  derived.spikingReachCm],
                    ['Blocking Reach', derived.blockingReachCm],
                  ].map(([label, val]) => (
                    <tr key={label as string}>
                      <td style={{ color: '#555', paddingBottom: '3px' }}>{label}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}>
                        {(val as number).toFixed(1)} cm
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ color: '#888', fontSize: '11px', paddingTop: '2px' }}>Blocking coef</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px', textAlign: 'right', color: '#888' }}>
                      ×{derived.blockingCoef}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#aaa', fontStyle: 'italic' }}>Not set</p>
            )}
          </section>

          {/* AP Budget */}
          <section>
            <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '6px' }}>
              Ability Points
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#555', paddingBottom: '3px' }}>Base</td>
                  <td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{apBudget.base}</td>
                </tr>
                <tr>
                  <td style={{ color: '#555', paddingBottom: '3px' }}>Year Bonus</td>
                  <td style={{ fontFamily: 'monospace', textAlign: 'right' }}>+{apBudget.yearBonus}</td>
                </tr>
                <tr>
                  <td style={{ color: '#555', paddingBottom: '3px' }}>Experience</td>
                  <td style={{ fontFamily: 'monospace', textAlign: 'right' }}>+{apBudget.experienceBonus}</td>
                </tr>
                {apBudget.levelUpGains > 0 && (
                  <tr>
                    <td style={{ color: '#555', paddingBottom: '3px' }}>Level-Up Gains</td>
                    <td style={{ fontFamily: 'monospace', textAlign: 'right' }}>+{apBudget.levelUpGains}</td>
                  </tr>
                )}
                <tr style={{ borderTop: '1px solid #ddd', paddingTop: '3px' }}>
                  <td style={{ fontWeight: 700, paddingTop: '4px' }}>Total</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 900, textAlign: 'right', paddingTop: '4px' }}>{apBudget.total}</td>
                </tr>
                <tr>
                  <td style={{ color: '#555', paddingBottom: '3px' }}>Spent</td>
                  <td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{apBudget.spent}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: '#E8741E' }}>Remaining</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 900, textAlign: 'right', color: '#E8741E' }}>{apBudget.remaining}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Level-up history */}
          {levelUpHistory.length > 0 && (
            <section>
              <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '6px' }}>
                Level-Up History
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#888', fontWeight: 600, paddingBottom: '3px' }}>Year</th>
                    <th style={{ textAlign: 'right', color: '#888', fontWeight: 600, paddingBottom: '3px' }}>Teams</th>
                    <th style={{ textAlign: 'right', color: '#888', fontWeight: 600, paddingBottom: '3px' }}>AP</th>
                    <th style={{ textAlign: 'right', color: '#888', fontWeight: 600, paddingBottom: '3px' }}>Height</th>
                  </tr>
                </thead>
                <tbody>
                  {levelUpHistory.map((r, i) => (
                    <tr key={i}>
                      <td style={{ paddingBottom: '2px' }}>Y{r.fromYear}→Y{r.toYear}</td>
                      <td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{r.teamsPlayed}</td>
                      <td style={{ fontFamily: 'monospace', textAlign: 'right', color: '#E8741E' }}>+{r.apGained}</td>
                      <td style={{ fontFamily: 'monospace', textAlign: 'right' }}>+{r.heightGainCm.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Skill stats */}
          <section>
            <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '6px' }}>
              Skill Stats
            </h2>
            {effectiveStats ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {SKILL_STAT_NAMES.map((stat) => {
                    const base = character.skills?.[stat];
                    const eff = effectiveStats[stat];
                    const delta = base !== undefined ? eff - base : 0;
                    return (
                      <tr key={stat}>
                        <td style={{ color: '#333', paddingBottom: '3px', width: '50%' }}>{stat}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}>
                          {eff.toFixed(2)}
                          {delta !== 0 && (
                            <span style={{ fontSize: '10px', marginLeft: '4px', color: delta > 0 ? '#27ae60' : '#e74c3c' }}>
                              ({delta > 0 ? '+' : ''}{delta.toFixed(2)})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#aaa', fontStyle: 'italic' }}>Not assigned</p>
            )}
          </section>

          {/* Abilities */}
          <section>
            <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '6px' }}>
              Selected Abilities ({selectedAbilities.length})
            </h2>
            {selectedAbilities.length === 0 ? (
              <p style={{ color: '#aaa', fontStyle: 'italic' }}>None</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {selectedAbilities.map((sel) => {
                  const ability = ABILITY_MAP[sel.abilityId];
                  if (!ability) return null;
                  const tierLabel =
                    sel.tier > 0 && ability.tiers && ability.tiers[sel.tier - 1]
                      ? ` — Tier ${toRoman(sel.tier)}: ${ability.tiers[sel.tier - 1].label}`
                      : '';
                  const choiceEntries = Object.entries(sel.chooserSelections);
                  const choiceStr =
                    choiceEntries.length > 0
                      ? ` [${choiceEntries.map(([, v]) => (Array.isArray(v) ? (v as string[]).join('+') : String(v))).join(', ')}]`
                      : '';
                  return (
                    <li key={sel.uid} style={{ marginBottom: '4px', display: 'flex', gap: '6px' }}>
                      <span style={{ color: '#E8741E', fontWeight: 700 }}>•</span>
                      <span>
                        <strong>{ability.name}</strong>
                        {tierLabel}
                        {choiceStr && <em style={{ color: '#555' }}>{choiceStr}</em>}
                        <span style={{ color: '#888', fontSize: '11px', marginLeft: '4px' }}>
                          ({ability.baseCost + (ability.tiers ? ability.tiers.slice(0, sel.tier).reduce((a, t) => a + t.addCost, 0) : 0)} AP)
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #ddd', marginTop: '16px', paddingTop: '8px', fontSize: '10px', color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
        <span>Haikyuu: Gauntlet RPG v2 Character Builder</span>
        <span>Generated {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );
}

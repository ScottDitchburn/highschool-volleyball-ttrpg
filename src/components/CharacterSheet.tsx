// CharacterSheet — Persistent live panel showing character state.
// Reads from useCharacter(); stubs where data is absent.
import React from 'react';
import { useCharacter } from '../state/characterStore';
import { SKILL_STAT_NAMES } from '../types';

interface Props {
  /** Mobile: allow collapsing the panel */
  collapsible?: boolean;
}

export function CharacterSheet({ collapsible = false }: Props) {
  const [collapsed, setCollapsed] = React.useState(false);
  const { character, effectiveStats, derivedReaches } = useCharacter();
  const { name, schoolYear, physical, apBudget, selectedAbilities, seeded, seed } = character;

  if (collapsible && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full btn-ghost text-sm py-2"
        aria-label="Show character sheet"
      >
        ▼ Character Sheet
      </button>
    );
  }

  const yearLabel = schoolYear === 1 ? '1st Year' : schoolYear === 2 ? '2nd Year' : '3rd Year';

  return (
    <aside className="character-sheet flex flex-col gap-4 text-sm" aria-label="Character sheet">
      {collapsible && (
        <button
          onClick={() => setCollapsed(true)}
          className="self-end text-charcoal-400 hover:text-orange-400 text-xs"
          aria-label="Collapse character sheet"
        >
          ▲ Hide
        </button>
      )}

      {/* Header */}
      <div className="border-b border-charcoal-700 pb-3">
        <div className="text-xl font-bold text-orange-400 truncate">
          {name || <span className="text-charcoal-500 italic">Unnamed Player</span>}
        </div>
        <div className="text-charcoal-400">{yearLabel}</div>
        {seeded && seed && (
          <div className="mt-1 inline-flex items-center gap-1 text-[0.65rem] font-mono px-1.5 py-0.5 rounded bg-orange-900/30 text-orange-300 border border-orange-800" title={`Seeded run — seed: ${seed}`}>
            🔒 seed: <span className="truncate max-w-[8rem]">{seed}</span>
          </div>
        )}
      </div>

      {/* Physical */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-500 mb-2">
          Physical
        </h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-charcoal-200">
          <span className="text-charcoal-400">Height</span>
          <span className="font-mono text-right">
            {physical ? (
              <>
                {(derivedReaches?.effectiveHeightCm ?? physical.heightCm).toFixed(1)} cm
                {derivedReaches && derivedReaches.effectiveHeightCm > physical.heightCm && (
                  <span className="text-orange-400 ml-1">
                    (+{(derivedReaches.effectiveHeightCm - physical.heightCm).toFixed(1)})
                  </span>
                )}
              </>
            ) : '—'}
          </span>
          <span className="text-charcoal-400">Vertical</span>
          <span className="font-mono text-right">
            {physical ? `${physical.verticalCm} cm` : '—'}
          </span>
        </div>
      </section>

      {/* Reaches */}
      {derivedReaches && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-500 mb-2">
            Reaches
          </h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-charcoal-200">
            <span className="text-charcoal-400">Standing</span>
            <span className="font-mono text-right">{derivedReaches.standingReachCm.toFixed(1)} cm</span>
            <span className="text-charcoal-400">Spiking</span>
            <span className="font-mono text-right">{derivedReaches.spikingReachCm.toFixed(1)} cm</span>
            <span className="text-charcoal-400">Blocking</span>
            <span className="font-mono text-right">{derivedReaches.blockingReachCm.toFixed(1)} cm</span>
          </div>
        </section>
      )}

      {/* Skills */}
      {effectiveStats && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-500 mb-2">
            Skill Stats
          </h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {SKILL_STAT_NAMES.map((stat) => (
              <React.Fragment key={stat}>
                <span className="text-charcoal-400">{stat}</span>
                <span className="font-mono text-right text-charcoal-200">
                  {effectiveStats[stat]?.toFixed(2) ?? '—'}
                </span>
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {/* AP Budget */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-500 mb-2">
          Ability Points
        </h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-charcoal-200">
          <span className="text-charcoal-400">Total</span>
          <span className="font-mono text-right">{apBudget.total}</span>
          <span className="text-charcoal-400">Spent</span>
          <span className="font-mono text-right">{apBudget.spent}</span>
          <span className="text-charcoal-400 font-semibold">Remaining</span>
          <span className={`font-mono font-bold text-right ${apBudget.remaining < 0 ? 'text-red-400' : 'text-orange-400'}`}>
            {apBudget.remaining}
          </span>
        </div>
        {/* AP meter */}
        <div className="mt-2 h-2 rounded-full bg-charcoal-700 overflow-hidden">
          <div
            className="h-full bg-orange-600 transition-all duration-300"
            style={{ width: `${Math.min(100, apBudget.total > 0 ? (apBudget.spent / apBudget.total) * 100 : 0)}%` }}
          />
        </div>
      </section>

      {/* Selected abilities count */}
      {selectedAbilities.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-500 mb-1">
            Abilities
          </h3>
          <div className="text-charcoal-300">{selectedAbilities.length} selected</div>
        </section>
      )}
    </aside>
  );
}

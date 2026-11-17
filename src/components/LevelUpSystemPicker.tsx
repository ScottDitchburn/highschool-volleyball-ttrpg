// src/components/LevelUpSystemPicker.tsx
// Review-step control for choosing the level-up system.
//
// Tournament (default) runs the Summer/Spring Interhigh arc. Weekly logs one
// record per match for AP only. Committing to either system rolls the character
// back to its pre-level-up state and locks the choice for good, so the picker
// spells out exactly what will be cleared before it asks.

import { useState } from 'react';
import { useCharacter } from '../state/characterStore';
import {
  LEVEL_UP_MODE_LABEL,
  isLevelUpModeLocked,
  levelUpModeOf,
  rollToHeightCm,
  weeklyMatchesOf,
  type LevelUpMode,
} from '../types';
import { cmDual } from '../utils/units';

const MODE_BLURB: Record<LevelUpMode, string> = {
  tournament:
    'Summer and Spring Interhigh events each school year. Spring grows your height, advances the year and eventually graduates you.',
  weekly:
    'One record per match played: Win +2 AP, Loss +1 AP, plus a note for your own reference. AP only — no height growth, and the school year stays put.',
};

function yearLabel(y: number): string {
  if (y === 1) return '1st Year';
  if (y === 2) return '2nd Year';
  return '3rd Year';
}

export function LevelUpSystemPicker() {
  const { character, dispatch } = useCharacter();
  const mode = levelUpModeOf(character);
  const locked = isLevelUpModeLocked(character);
  const [choice, setChoice] = useState<LevelUpMode>(mode);
  const [pending, setPending] = useState<LevelUpMode | null>(null);

  // What committing would clear, so the warning can be specific.
  const recordCount = character.levelUpHistory.length + weeklyMatchesOf(character).length;
  const apReverted = character.apBudget.levelUpGains;
  const baseHeightCm = character.physical ? rollToHeightCm(character.physical.heightRoll) : null;
  const heightReverted =
    character.physical && baseHeightCm !== null && character.physical.heightCm > baseHeightCm
      ? { from: character.physical.heightCm, to: baseHeightCm }
      : null;
  const startingYear = character.yearRoll ?? character.schoolYear;
  const yearReverted =
    character.graduated === true || startingYear !== character.schoolYear ? startingYear : null;
  const hasProgress =
    recordCount > 0 || apReverted > 0 || heightReverted !== null || yearReverted !== null;

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-500">
            Level-Up System
          </h3>
          <p className="text-charcoal-400 text-sm mt-1 max-w-prose">
            {MODE_BLURB[locked ? mode : choice]}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          {locked ? (
            <>
              <span className="text-sm font-bold text-orange-400 bg-charcoal-800 border border-charcoal-700 rounded-lg px-4 py-2">
                {LEVEL_UP_MODE_LABEL[mode]}
              </span>
              <span className="text-charcoal-500 text-xs">Locked in</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <label htmlFor="levelup-system" className="sr-only">
                  Level-up system
                </label>
                <select
                  id="levelup-system"
                  value={choice}
                  onChange={(e) => setChoice(e.target.value as LevelUpMode)}
                  className="bg-charcoal-800 border border-charcoal-600 text-charcoal-100 text-sm font-semibold rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
                >
                  <option value="tournament">Tournament (Default)</option>
                  <option value="weekly">Weekly</option>
                </select>
                <button
                  onClick={() => setPending(choice)}
                  className="text-sm py-2 px-4 rounded-lg font-bold bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                >
                  Lock In
                </button>
              </div>
              <span className="text-charcoal-500 text-xs">Locking in cannot be undone</span>
            </>
          )}
        </div>
      </div>

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Lock in the ${LEVEL_UP_MODE_LABEL[pending]} level-up system`}
        >
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-red-800 px-6 py-4">
              <h2 className="text-xl font-black text-white tracking-tight">
                Lock in {LEVEL_UP_MODE_LABEL[pending]}?
              </h2>
              <p className="text-red-200 text-sm mt-0.5">This cannot be undone.</p>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <p className="text-charcoal-300 text-sm">{MODE_BLURB[pending]}</p>

              <div className="bg-charcoal-800 rounded-lg p-4 flex flex-col gap-2 text-sm">
                <div className="text-charcoal-200 font-semibold">
                  {hasProgress
                    ? 'Your character resets to the state it was in before any level-up:'
                    : 'Nothing to reset — this character has no level-up progress yet.'}
                </div>
                {hasProgress && (
                  <ul className="text-charcoal-400 flex flex-col gap-1 list-disc pl-5">
                    {recordCount > 0 && (
                      <li>
                        {recordCount} recorded {recordCount === 1 ? 'event' : 'events'} cleared
                      </li>
                    )}
                    {apReverted > 0 && (
                      <li>
                        <span className="text-orange-400 font-bold">−{apReverted} AP</span> of
                        level-up gains returned
                      </li>
                    )}
                    {heightReverted && (
                      <li>
                        Height back to {cmDual(heightReverted.to)} (from{' '}
                        {cmDual(heightReverted.from)})
                      </li>
                    )}
                    {yearReverted !== null && (
                      <li>
                        School year back to {yearLabel(yearReverted)}
                        {character.graduated === true ? ' (no longer a graduate)' : ''}
                      </li>
                    )}
                  </ul>
                )}
              </div>

              <p className="text-charcoal-500 text-xs">
                Your purchased abilities are kept. If they now cost more than your reverted AP
                total, the meter reads over-budget until you deselect some — and any ability whose
                prerequisites no longer hold is removed automatically.
              </p>

              <div className="flex gap-3">
                <button onClick={() => setPending(null)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_LEVEL_UP_MODE', mode: pending });
                    setPending(null);
                  }}
                  className="flex-1 text-sm py-2 px-4 rounded-lg font-bold bg-red-700 hover:bg-red-800 text-white transition-colors"
                >
                  Lock in {LEVEL_UP_MODE_LABEL[pending]}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

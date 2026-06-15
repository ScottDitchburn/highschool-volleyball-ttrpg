// src/components/LevelUpModal.tsx
// Interhigh level-up flow. Driven by a `season` prop:
//   summer → enter Prelim/National games → AP only (no advance, no height).
//   spring → enter games → roll 1d20×0.1cm height → confirm → AP + advance year
//            (or graduate at 3rd year).

import { useState, useCallback, useEffect } from 'react';
import { useCharacter } from '../state/characterStore';
import { DiceRoller } from './DiceRoller';
import { seededLevelUpHeight } from '../rng/seeded';
import { interhighAp, type InterhighSeason, type SchoolYear } from '../types';
import { cmDual } from '../utils/units';

interface Props {
  season: InterhighSeason;
  onClose: () => void;
  /** Called after successfully applying the event, to navigate to the abilities step */
  onGoToAbilities?: () => void;
}

type SpringStep = 'games' | 'height-roll' | 'confirm';

function yearLabel(y: SchoolYear): string {
  if (y === 1) return '1st Year';
  if (y === 2) return '2nd Year';
  return '3rd Year';
}

// ── Game counter ─────────────────────────────────────────────────────────────

function GameCounter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-charcoal-800 rounded-lg px-4 py-3">
      <span className="text-sm font-semibold text-charcoal-200">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-full bg-charcoal-700 hover:bg-charcoal-600 text-charcoal-200 font-bold flex items-center justify-center transition-colors"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="w-8 text-center text-2xl font-black text-orange-400 font-mono">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full bg-charcoal-700 hover:bg-charcoal-600 text-charcoal-200 font-bold flex items-center justify-center transition-colors"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function LevelUpModal({ season, onClose, onGoToAbilities }: Props) {
  const { character, dispatch } = useCharacter();

  const year = character.schoolYear;
  const isThirdYear = year >= 3;
  const isSpring = season === 'spring';

  const [step, setStep] = useState<SpringStep>('games');
  const [prelimGames, setPrelimGames] = useState(0);
  const [nationalGames, setNationalGames] = useState(0);
  const [heightGainCm, setHeightGainCm] = useState<number | null>(null);

  const apGained = interhighAp(prelimGames, nationalGames);
  const nextYear = (isThirdYear ? year : year + 1) as SchoolYear;

  // Spring height is seed-determined in a seeded run, keyed by the year the Spring occurs in.
  const seededHeight = character.seeded && character.seed
    ? seededLevelUpHeight(character.seed, year)
    : null;

  useEffect(() => {
    if (isSpring && step === 'height-roll' && seededHeight && heightGainCm === null) {
      setHeightGainCm(seededHeight.cm);
    }
  });

  const handleHeightRoll = useCallback((value: number) => {
    setHeightGainCm(parseFloat((value * 0.1).toFixed(1)));
  }, []);

  const applySummer = useCallback(() => {
    dispatch({ type: 'INTERHIGH', season: 'summer', prelimGames, nationalGames, heightGainCm: 0 });
    onClose();
    onGoToAbilities?.();
  }, [dispatch, prelimGames, nationalGames, onClose, onGoToAbilities]);

  const applySpring = useCallback(() => {
    if (heightGainCm === null) return;
    dispatch({ type: 'INTERHIGH', season: 'spring', prelimGames, nationalGames, heightGainCm });
    onClose();
    onGoToAbilities?.();
  }, [dispatch, prelimGames, nationalGames, heightGainCm, onClose, onGoToAbilities]);

  const title = season === 'summer'
    ? 'Summer Interhigh'
    : isThirdYear ? 'Spring Interhigh & Graduation' : 'Spring Interhigh';

  const subtitle = season === 'summer'
    ? `${yearLabel(year)} · bonus AP`
    : isThirdYear ? `${yearLabel(year)} → Graduate` : `${yearLabel(year)} → ${yearLabel(nextYear)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-orange-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">{title}</h2>
            <p className="text-orange-200 text-sm mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-orange-200 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* ── Games entry (both seasons start here) ── */}
          {step === 'games' && (
            <>
              <div>
                <h3 className="text-base font-bold text-charcoal-200 mb-1">Games played</h3>
                <p className="text-charcoal-400 text-sm">
                  AP gain = (2 × Prelim) + (3 × National)
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <GameCounter label="Prelim Games" value={prelimGames} onChange={setPrelimGames} />
                <GameCounter label="National Games" value={nationalGames} onChange={setNationalGames} />
              </div>

              <div className="bg-charcoal-800 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-charcoal-300">
                  <span>AP gain:</span>
                  <span className="font-black text-orange-400 text-base">+{apGained} AP</span>
                </div>
                <div className="text-charcoal-500 text-xs mt-1">
                  (2 × {prelimGames}) + (3 × {nationalGames}) = {apGained}
                </div>
              </div>

              {season === 'summer' ? (
                <button onClick={applySummer} className="btn-primary">
                  Apply Summer Interhigh
                </button>
              ) : (
                <button onClick={() => setStep('height-roll')} className="btn-primary">
                  Next: Roll Height Growth
                </button>
              )}
            </>
          )}

          {/* ── Spring: height roll ── */}
          {isSpring && step === 'height-roll' && (
            <>
              <div>
                <h3 className="text-base font-bold text-charcoal-200 mb-1">Roll height growth</h3>
                <p className="text-charcoal-400 text-sm">
                  1d20 × 0.1 cm — added to your base height.
                </p>
              </div>

              <DiceRoller
                numDice={1}
                sides={20}
                mode="single"
                label="Height Growth Roll (1d20)"
                onResult={handleHeightRoll}
                locked={!!seededHeight}
                initialValue={seededHeight?.die}
              />

              {heightGainCm !== null && (
                <div className="bg-charcoal-800 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-charcoal-300">
                    <span>Height gain:</span>
                    <span className="font-black text-orange-400 text-base">+{heightGainCm.toFixed(1)} cm</span>
                  </div>
                  {character.physical && (
                    <div className="text-charcoal-500 text-xs mt-1">
                      {cmDual(character.physical.heightCm)} → {cmDual(character.physical.heightCm + heightGainCm)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep('games')} className="btn-ghost flex-1">
                  Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={heightGainCm === null}
                  className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next: Review
                </button>
              </div>
            </>
          )}

          {/* ── Spring: confirm ── */}
          {isSpring && step === 'confirm' && heightGainCm !== null && (
            <>
              <div>
                <h3 className="text-base font-bold text-charcoal-200 mb-1">Confirm Spring Interhigh</h3>
                <p className="text-charcoal-400 text-sm">Review the changes before applying.</p>
              </div>

              <div className="bg-charcoal-800 rounded-lg divide-y divide-charcoal-700 text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-charcoal-400">School Year</span>
                  <span className="text-charcoal-200 font-semibold">
                    {yearLabel(year)} → <span className="text-orange-400">{isThirdYear ? 'Graduate' : yearLabel(nextYear)}</span>
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-charcoal-400">Games (Prelim / National)</span>
                  <span className="text-charcoal-200 font-semibold">{prelimGames} / {nationalGames}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-charcoal-400">AP Gained</span>
                  <span className="text-orange-400 font-black">+{apGained}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-charcoal-400">New AP Total</span>
                  <span className="text-charcoal-200 font-semibold">{character.apBudget.total + apGained}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-charcoal-400">Height Gain</span>
                  <span className="text-orange-400 font-black">+{heightGainCm.toFixed(1)} cm</span>
                </div>
                {character.physical && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-charcoal-400">New Height</span>
                    <span className="text-charcoal-200 font-semibold">
                      {cmDual(character.physical.heightCm + heightGainCm)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-charcoal-400">Unlocks</span>
                  <span className="text-charcoal-300 text-xs">
                    Yearly Only abilities{!isThirdYear ? `, ${nextYear >= 2 ? 'Not First Year' : ''}` : ''}
                    {isThirdYear ? 'Graduation' : nextYear === 3 ? ', Third Year' : ''}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('height-roll')} className="btn-ghost flex-1">
                  Back
                </button>
                <button onClick={applySpring} className="btn-primary flex-1">
                  {isThirdYear ? 'Apply & Graduate' : 'Apply Spring Interhigh'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

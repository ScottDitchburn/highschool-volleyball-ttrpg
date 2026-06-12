// src/components/LevelUpModal.tsx
// Guided level-up flow: teams played → height roll → confirm → apply.

import { useState, useCallback, useEffect } from 'react';
import { useCharacter } from '../state/characterStore';
import { DiceRoller } from './DiceRoller';
import { seededLevelUpHeight } from '../rng/seeded';
import type { SchoolYear } from '../types';
import { cmDual } from '../utils/units';

interface Props {
  onClose: () => void;
  /** Called after successful level-up to navigate to abilities step */
  onGoToAbilities?: () => void;
}

type ModalStep = 'teams' | 'height-roll' | 'confirm' | 'graduated';

function yearLabel(y: SchoolYear): string {
  if (y === 1) return '1st Year';
  if (y === 2) return '2nd Year';
  return '3rd Year';
}

export function LevelUpModal({ onClose, onGoToAbilities }: Props) {
  const { character, dispatch } = useCharacter();

  const currentYear = character.schoolYear;
  const isMaxYear = currentYear >= 3;

  // If already 3rd year, show graduation prompt immediately
  const [modalStep, setModalStep] = useState<ModalStep>(isMaxYear ? 'graduated' : 'teams');

  const [teamsPlayed, setTeamsPlayed] = useState(1);
  const [heightGainCm, setHeightGainCm] = useState<number | null>(null);

  // Computed AP gain from teams played
  const apGained = 3 + 2 * teamsPlayed;
  const nextYear = Math.min(currentYear + 1, 3) as SchoolYear;
  const seededHeight = character.seeded && character.seed
    ? seededLevelUpHeight(character.seed, nextYear)
    : null;

  // In a seeded run the height growth is determined by the seed, not rolled.
  useEffect(() => {
    if (modalStep === 'height-roll' && seededHeight && heightGainCm === null) {
      setHeightGainCm(seededHeight.cm);
    }
  });

  // Step 1: teams played
  const handleTeamsConfirm = useCallback(() => {
    setModalStep('height-roll');
  }, []);

  // Step 2: height roll result
  const handleHeightRoll = useCallback((value: number) => {
    // 1d20 × 0.1 cm
    setHeightGainCm(parseFloat((value * 0.1).toFixed(1)));
  }, []);

  // Step 3: apply level-up
  const handleConfirm = useCallback(() => {
    if (heightGainCm === null) return;
    dispatch({
      type: 'LEVEL_UP',
      teamsPlayed,
      heightGainCm,
      apGained,
    });
    onClose();
    if (onGoToAbilities) onGoToAbilities();
  }, [dispatch, teamsPlayed, heightGainCm, apGained, onClose, onGoToAbilities]);

  // Graduation: reset after export offer
  const handleGraduate = useCallback(() => {
    dispatch({ type: 'RESET' });
    onClose();
  }, [dispatch, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Level Up"
    >
      <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-orange-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              {modalStep === 'graduated' ? 'Graduation' : 'Level Up'}
            </h2>
            {modalStep !== 'graduated' && (
              <p className="text-orange-200 text-sm mt-0.5">
                {yearLabel(currentYear)} → {yearLabel(nextYear)}
              </p>
            )}
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
          {/* ── Step: Graduated ── */}
          {modalStep === 'graduated' && (
            <>
              <div className="text-center py-4">
                <div className="text-5xl mb-3">🎓</div>
                <h3 className="text-xl font-bold text-orange-400 mb-2">
                  {character.name || 'Your player'} has graduated!
                </h3>
                <p className="text-charcoal-300 text-sm">
                  3rd-year players cannot level up further. Export your character
                  sheet before starting a new character.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={onClose}
                  className="btn-ghost"
                >
                  Keep Reviewing / Export
                </button>
                <button
                  onClick={handleGraduate}
                  className="bg-red-700 hover:bg-red-800 text-white font-bold px-5 py-2.5 rounded-lg transition-colors"
                >
                  Start New Character (Reset)
                </button>
              </div>
            </>
          )}

          {/* ── Step 1: Teams Played ── */}
          {modalStep === 'teams' && (
            <>
              <div>
                <h3 className="text-base font-bold text-charcoal-200 mb-1">
                  How many teams did you play against this year?
                </h3>
                <p className="text-charcoal-400 text-sm">
                  AP gain = 3 + 2 × teams played
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setTeamsPlayed(t => Math.max(0, t - 1))}
                  className="w-10 h-10 rounded-full bg-charcoal-700 hover:bg-charcoal-600
                             text-charcoal-200 font-bold text-xl flex items-center justify-center
                             transition-colors"
                  aria-label="Decrease"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <span className="text-4xl font-black text-orange-400">{teamsPlayed}</span>
                  <div className="text-charcoal-500 text-xs mt-1">teams played</div>
                </div>
                <button
                  onClick={() => setTeamsPlayed(t => t + 1)}
                  className="w-10 h-10 rounded-full bg-charcoal-700 hover:bg-charcoal-600
                             text-charcoal-200 font-bold text-xl flex items-center justify-center
                             transition-colors"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>

              <div className="bg-charcoal-800 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-charcoal-300">
                  <span>AP gain:</span>
                  <span className="font-black text-orange-400 text-base">
                    +{apGained} AP
                  </span>
                </div>
                <div className="text-charcoal-500 text-xs mt-1">
                  3 + 2 × {teamsPlayed} = {apGained}
                </div>
              </div>

              <button
                onClick={handleTeamsConfirm}
                className="btn-primary"
              >
                Next: Roll Height Growth
              </button>
            </>
          )}

          {/* ── Step 2: Height Roll ── */}
          {modalStep === 'height-roll' && (
            <>
              <div>
                <h3 className="text-base font-bold text-charcoal-200 mb-1">
                  Roll height growth
                </h3>
                <p className="text-charcoal-400 text-sm">
                  1d20 × 0.1 cm — this is added to your base height.
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
                    <span className="font-black text-orange-400 text-base">
                      +{heightGainCm.toFixed(1)} cm
                    </span>
                  </div>
                  {character.physical && (
                    <div className="text-charcoal-500 text-xs mt-1">
                      {cmDual(character.physical.heightCm)} → {cmDual(character.physical.heightCm + heightGainCm)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setModalStep('teams')}
                  className="btn-ghost flex-1"
                >
                  Back
                </button>
                <button
                  onClick={() => setModalStep('confirm')}
                  disabled={heightGainCm === null}
                  className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next: Review
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Confirm Summary ── */}
          {modalStep === 'confirm' && heightGainCm !== null && (
            <>
              <div>
                <h3 className="text-base font-bold text-charcoal-200 mb-1">
                  Confirm level-up
                </h3>
                <p className="text-charcoal-400 text-sm">
                  Review the changes before applying.
                </p>
              </div>

              <div className="bg-charcoal-800 rounded-lg divide-y divide-charcoal-700 text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-charcoal-400">School Year</span>
                  <span className="text-charcoal-200 font-semibold">
                    {yearLabel(currentYear)} → <span className="text-orange-400">{yearLabel(nextYear)}</span>
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-charcoal-400">Teams Played</span>
                  <span className="text-charcoal-200 font-semibold">{teamsPlayed}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-charcoal-400">AP Gained</span>
                  <span className="text-orange-400 font-black">+{apGained}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-charcoal-400">New AP Total</span>
                  <span className="text-charcoal-200 font-semibold">
                    {character.apBudget.total + apGained}
                  </span>
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
                    Yearly Only abilities{nextYear > 1 ? ', Not First Year' : ''}
                    {nextYear === 3 ? ', Third Year' : ''}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setModalStep('height-roll')}
                  className="btn-ghost flex-1"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  className="btn-primary flex-1"
                >
                  Apply Level-Up
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

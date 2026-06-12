// ─────────────────────────────────────────────────────────────────────────────
// DiceRoller — reusable dice rolling component
//
// Props:
//   numDice        — how many dice to roll
//   sides          — faces per die (e.g. 10, 4, 8)
//   mode           — "sum" | "average" | "single"
//                    "sum"     → total of all dice (used for 3d10)
//                    "average" → mean, rounded to 2dp (used for 4d4)
//                    "single"  → single-die pass-through (1d3, 1d20, etc.)
//   label          — optional heading (e.g. "Roll A")
//   onResult       — callback(value: number, individualDice: number[])
//   disabled       — disables roll button
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useId } from 'react';

export type DiceMode = 'sum' | 'average' | 'single';

export interface DiceRollerProps {
  numDice: number;
  sides: number;
  mode: DiceMode;
  label?: string;
  onResult: (value: number, individualDice: number[]) => void;
  disabled?: boolean;
  /** Initial rolled dice to display (e.g. restored from state) */
  initialDice?: number[];
  /** Initial computed value */
  initialValue?: number;
}

/** Generate a cryptographically random integer in [1, sides] */
function rollDie(sides: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % sides) + 1;
}

function computeValue(dice: number[], mode: DiceMode): number {
  if (dice.length === 0) return 0;
  if (mode === 'sum' || mode === 'single') {
    return dice.reduce((a, b) => a + b, 0);
  }
  // average — round to 2 decimal places
  const avg = dice.reduce((a, b) => a + b, 0) / dice.length;
  return Math.round(avg * 100) / 100;
}

/** Simple pip count display for d4–d10 ranges */
function DieFace({ value, sides, animating }: { value: number; sides: number; animating: boolean }) {
  const base =
    'inline-flex items-center justify-center rounded-lg font-black select-none transition-all duration-200';

  const sizeClass = 'w-10 h-10 text-base';

  // During animation show a rotating "?" placeholder
  if (animating) {
    return (
      <span
        className={`${base} ${sizeClass} bg-charcoal-700 text-charcoal-400 animate-spin`}
        aria-hidden="true"
        style={{ animationDuration: '0.3s' }}
      >
        ?
      </span>
    );
  }

  // Color by result quality (low=cool blue tones, high=warm orange)
  const pct = (value - 1) / (sides - 1); // 0..1
  const bgClass =
    pct >= 0.8 ? 'bg-orange-600 text-white' :
    pct >= 0.5 ? 'bg-orange-800 text-orange-200' :
    pct >= 0.3 ? 'bg-charcoal-700 text-charcoal-200' :
                 'bg-charcoal-800 text-charcoal-400';

  return (
    <span
      className={`${base} ${sizeClass} ${bgClass} border border-charcoal-600`}
      aria-label={`Die face: ${value}`}
    >
      {value}
    </span>
  );
}

export function DiceRoller({
  numDice,
  sides,
  mode,
  label,
  onResult,
  disabled = false,
  initialDice,
  initialValue,
}: DiceRollerProps) {
  const id = useId();

  const [rolledDice, setRolledDice] = useState<number[]>(initialDice ?? []);
  const [computedValue, setComputedValue] = useState<number | null>(initialValue ?? null);
  const [animating, setAnimating] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualActive, setManualActive] = useState(false);
  const [manualError, setManualError] = useState('');

  // Legal range for the result value
  const minResult = mode === 'average' ? 1 : numDice;
  const maxResult = mode === 'average' ? sides : numDice * sides;

  const handleRoll = useCallback(() => {
    if (disabled || animating) return;
    setManualActive(false);
    setManualInput('');
    setManualError('');
    setAnimating(true);

    // Short animation then set real values
    setTimeout(() => {
      const dice = Array.from({ length: numDice }, () => rollDie(sides));
      const value = computeValue(dice, mode);
      setRolledDice(dice);
      setComputedValue(value);
      setAnimating(false);
      onResult(value, dice);
    }, 400);
  }, [disabled, animating, numDice, sides, mode, onResult]);

  const handleManualChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setManualInput(raw);
      setManualError('');

      if (raw === '' || raw === '-') return;

      const parsed = mode === 'average' ? parseFloat(raw) : parseInt(raw, 10);
      if (isNaN(parsed)) {
        setManualError('Not a number');
        return;
      }
      if (parsed < minResult || parsed > maxResult) {
        setManualError(`Must be ${minResult}–${maxResult}`);
        return;
      }
      // Validate step for average mode (0.25 steps)
      if (mode === 'average') {
        const steps = Math.round(parsed * 4);
        if (Math.abs(steps / 4 - parsed) > 0.001) {
          setManualError('Must be a multiple of 0.25');
          return;
        }
      }

      // Valid manual entry — clear dice display, use manual value
      setManualActive(true);
      setRolledDice([]);
      setComputedValue(parsed);
      onResult(parsed, []);
    },
    [mode, minResult, maxResult, onResult]
  );

  const modeLabel =
    mode === 'sum'     ? 'Sum' :
    mode === 'average' ? 'Avg' :
                         'Result';

  return (
    <div
      className="card flex flex-col gap-3"
      role="group"
      aria-label={label ? `${label} dice roller` : 'Dice roller'}
    >
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-charcoal-300 uppercase tracking-wide">
            {label}
          </span>
          <span className="text-xs text-charcoal-500">
            {numDice}d{sides}
          </span>
        </div>
      )}

      {/* Dice faces row */}
      <div className="flex items-center gap-2 flex-wrap min-h-[2.75rem]">
        {animating ? (
          Array.from({ length: numDice }).map((_, i) => (
            <DieFace key={i} value={1} sides={sides} animating />
          ))
        ) : manualActive ? (
          <span className="text-charcoal-400 text-sm italic">
            Manual entry — no dice to show
          </span>
        ) : rolledDice.length > 0 ? (
          <>
            {rolledDice.map((v, i) => (
              <DieFace key={i} value={v} sides={sides} animating={false} />
            ))}
          </>
        ) : (
          <span className="text-charcoal-600 text-sm italic">Roll or enter a value below</span>
        )}
      </div>

      {/* Total / Average display */}
      {(computedValue !== null) && (
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-charcoal-500 uppercase tracking-wide">{modeLabel}:</span>
          <span className="text-2xl font-black text-orange-400">
            {mode === 'average' ? computedValue.toFixed(2) : computedValue}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleRoll}
          disabled={disabled || animating}
          className="btn-primary text-sm py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={`Roll ${numDice}d${sides}`}
        >
          {animating ? 'Rolling…' : `Roll ${numDice}d${sides}`}
        </button>

        {/* Manual entry */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-[7rem]">
          <label htmlFor={`${id}-manual`} className="text-xs text-charcoal-500">
            Manual ({minResult}–{maxResult}{mode === 'average' ? ', step 0.25' : ''})
          </label>
          <input
            id={`${id}-manual`}
            type="number"
            value={manualInput}
            onChange={handleManualChange}
            min={minResult}
            max={maxResult}
            step={mode === 'average' ? 0.25 : 1}
            placeholder={`${minResult}–${maxResult}`}
            disabled={disabled}
            className={`bg-charcoal-800 border rounded px-2 py-1.5 text-sm text-charcoal-100
                        placeholder:text-charcoal-600 focus:outline-none focus:ring-1
                        disabled:opacity-40 disabled:cursor-not-allowed w-full
                        ${manualError
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-charcoal-600 focus:border-orange-600 focus:ring-orange-600'
                        }`}
            aria-describedby={manualError ? `${id}-error` : undefined}
          />
          {manualError && (
            <span id={`${id}-error`} className="text-xs text-red-400" role="alert">
              {manualError}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

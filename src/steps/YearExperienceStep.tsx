import { useState, useCallback } from 'react';
import { DiceRoller } from '../components/DiceRoller';
import { useCharacter } from '../state/characterStore';

import { type YearRoll } from '../types';

const YEAR_BONUS_CONFIG: Record<2 | 3, { numDice: number; baseBonus: number; label: string }> = {
  2: { numDice: 2, baseBonus: 3, label: 'Bonus AP (2d4)' },
  3: { numDice: 4, baseBonus: 6, label: 'Bonus AP (4d4)' },
};

function BudgetRow({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <>
      <span className="text-charcoal-400 text-sm">{label}</span>
      <span className={`font-mono text-right text-sm ${accent ? 'text-orange-400 font-bold text-base' : 'text-charcoal-200'}`}>
        {value}
      </span>
    </>
  );
}

export function YearExperienceStep() {
  const { character, dispatch } = useCharacter();
  const { yearRoll, experience, apBudget } = character;
  const seeded = character.seeded;

  const [bonusRoll, setBonusRoll] = useState<number | null>(null);
  const [pendingYear, setPendingYear] = useState<YearRoll | null>(null);

  const commitYear = useCallback(
    (roll: YearRoll, bonus: number) => {
      dispatch({ type: 'SET_YEAR_ROLL', roll, yearBonus: bonus });
      setPendingYear(null);
      setBonusRoll(null);
    },
    [dispatch]
  );

  const handleYearRoll = useCallback(
    (value: number) => {
      const roll = value as YearRoll;
      if (roll === 1) {
        commitYear(1, 0);
      } else {
        setPendingYear(roll);
        setBonusRoll(null);
      }
    },
    [commitYear]
  );

  const handleBonusRoll = useCallback((value: number) => {
    setBonusRoll(value);
  }, []);

  const confirmBonus = useCallback(() => {
    if (pendingYear !== null && pendingYear !== 1 && bonusRoll !== null) {
      const config = YEAR_BONUS_CONFIG[pendingYear as 2 | 3];
      commitYear(pendingYear, config.baseBonus + bonusRoll);
    }
  }, [pendingYear, bonusRoll, commitYear]);

  const handleManualYear = useCallback(
    (roll: YearRoll) => {
      if (roll === 1) {
        commitYear(1, 0);
      } else {
        setPendingYear(roll);
        setBonusRoll(null);
      }
    },
    [commitYear]
  );

  const handleExpRoll = useCallback(
    (value: number) => {
      dispatch({ type: 'SET_EXPERIENCE_ROLL', roll: value });
    },
    [dispatch]
  );

  const displayYear = pendingYear ?? yearRoll;
  const yearLabel =
    displayYear === 1 ? '1st Year' :
    displayYear === 2 ? '2nd Year' :
    displayYear === 3 ? '3rd Year' : null;

  const bonusConfig = (pendingYear !== null && pendingYear !== 1)
    ? YEAR_BONUS_CONFIG[pendingYear as 2 | 3]
    : null;

  const committedBonusValue: number | undefined = (() => {
    if (yearRoll && yearRoll !== 1 && apBudget.yearBonus > 0) {
      const base = YEAR_BONUS_CONFIG[yearRoll as 2 | 3].baseBonus;
      return apBudget.yearBonus - base;
    }
    return undefined;
  })();

  const expLabel = experience
    ? `${experience.label} (+${experience.bonus})`
    : '—';

  const yearBonusLabel = (() => {
    if (!yearRoll) return '—';
    if (yearRoll === 1) return '+0 (1st Year)';
    const config = YEAR_BONUS_CONFIG[yearRoll as 2 | 3];
    if (apBudget.yearBonus === 0 && !bonusConfig) return 'Roll bonus dice...';
    return `+${apBudget.yearBonus} (${yearRoll === 2 ? '2nd' : '3rd'} Year: ${config.baseBonus} + ${apBudget.yearBonus - config.baseBonus})`;
  })();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-orange-400">Year &amp; Experience</h2>
        <p className="text-charcoal-400 mt-1 text-sm">
          Roll to determine your School Year, then roll for Previous Experience. These set your Ability Point budget.
        </p>
      </div>

      {/* School Year */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-charcoal-500">
          School Year
        </h3>

        <div className="flex gap-2 flex-wrap">
          {([1, 2, 3] as YearRoll[]).map((y) => {
            const active = displayYear === y;
            return (
              <button
                key={y}
                type="button"
                onClick={() => !seeded && handleManualYear(y)}
                disabled={seeded}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${active
                    ? 'bg-orange-600 border-orange-500 text-white'
                    : 'bg-charcoal-800 border-charcoal-600 text-charcoal-300 hover:border-orange-600 hover:text-orange-300'
                  }`}
              >
                {y === 1 ? '1st' : y === 2 ? '2nd' : '3rd'} Year
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-charcoal-700" />
          <span className="text-charcoal-600 text-xs uppercase tracking-wide">or roll</span>
          <div className="h-px flex-1 bg-charcoal-700" />
        </div>

        <DiceRoller
          numDice={1}
          sides={3}
          mode="single"
          label="School Year (1d3)"
          onResult={handleYearRoll}
          initialValue={yearRoll ?? undefined}
          locked={seeded}
        />

        {yearLabel && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-charcoal-400">Result:</span>
            <span className="text-orange-300 font-semibold">{yearLabel}</span>
          </div>
        )}
      </section>

      {/* Bonus AP dice for 2nd/3rd year — pending confirmation */}
      {bonusConfig && pendingYear !== null && (
        <section className="flex flex-col gap-3 border border-orange-900/40 rounded-xl p-4 bg-charcoal-900/50">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-orange-600">
              Bonus AP Dice
            </h3>
            <p className="text-charcoal-400 text-xs mt-1">
              {pendingYear === 2
                ? 'As a 2nd Year you receive 3 + 2d4 bonus AP. Roll your bonus below.'
                : 'As a 3rd Year you receive 6 + 4d4 bonus AP. Roll your bonus below.'}
            </p>
          </div>

          <DiceRoller
            numDice={bonusConfig.numDice}
            sides={4}
            mode="sum"
            label={bonusConfig.label}
            onResult={handleBonusRoll}
          />

          {bonusRoll !== null && (
            <>
              <div className="text-sm text-charcoal-300">
                Bonus AP = <span className="text-charcoal-500">{bonusConfig.baseBonus}</span>
                {' '}+ <span className="text-orange-300 font-semibold">{bonusRoll}</span>
                {' '}= <span className="text-orange-400 font-bold">{bonusConfig.baseBonus + bonusRoll}</span>
              </div>
              <button
                type="button"
                onClick={confirmBonus}
                className="btn-primary self-start text-sm py-2 px-5"
              >
                Confirm Bonus
              </button>
            </>
          )}
        </section>
      )}

      {/* Committed bonus AP for 2nd/3rd year — re-rollable */}
      {yearRoll && yearRoll !== 1 && !bonusConfig && apBudget.yearBonus > 0 && (
        <section className="flex flex-col gap-3 border border-charcoal-700 rounded-xl p-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-charcoal-500">
            Bonus AP
          </h3>
          <DiceRoller
            numDice={YEAR_BONUS_CONFIG[yearRoll as 2 | 3].numDice}
            sides={4}
            mode="sum"
            label={YEAR_BONUS_CONFIG[yearRoll as 2 | 3].label}
            onResult={(value) => {
              const config = YEAR_BONUS_CONFIG[yearRoll as 2 | 3];
              dispatch({ type: 'SET_YEAR_ROLL', roll: yearRoll, yearBonus: config.baseBonus + value });
            }}
            initialValue={committedBonusValue}
            locked={seeded}
          />
          <div className="text-sm text-charcoal-400">
            Current bonus AP: <span className="text-orange-400 font-bold">{apBudget.yearBonus}</span>
            {' '}({yearRoll === 2 ? '3' : '6'} base + {apBudget.yearBonus - YEAR_BONUS_CONFIG[yearRoll as 2 | 3].baseBonus} rolled)
          </div>
        </section>
      )}

      {/* Previous Experience */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-charcoal-500">
          Previous Experience
        </h3>

        <DiceRoller
          numDice={2}
          sides={8}
          mode="sum"
          label="Previous Experience (2d8)"
          onResult={handleExpRoll}
          initialValue={experience?.roll ?? undefined}
          locked={seeded}
        />

        {experience && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-charcoal-400">Result:</span>
              <span className="text-charcoal-200 font-semibold">{experience.label}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-charcoal-400">Bonus AP:</span>
              <span className="text-orange-300 font-bold">+{experience.bonus}</span>
            </div>
          </div>
        )}

        <details className="text-xs text-charcoal-500">
          <summary className="cursor-pointer hover:text-charcoal-300 select-none">
            Show experience table
          </summary>
          <table className="mt-2 w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="border border-charcoal-700 px-2 py-1 text-charcoal-400">Roll</th>
                <th className="border border-charcoal-700 px-2 py-1 text-charcoal-400">Tier</th>
                <th className="border border-charcoal-700 px-2 py-1 text-charcoal-400">AP</th>
              </tr>
            </thead>
            <tbody>
              {[
                { range: '2-3',   label: 'No Experience',           bonus: 0 },
                { range: '4-7',   label: 'Recreational Player',     bonus: 1 },
                { range: '8-11',  label: 'Middle School Team',      bonus: 2 },
                { range: '12-15', label: 'Middle School Starter',   bonus: 3 },
                { range: '16',    label: 'Middle School Contender', bonus: 4 },
              ].map(({ range, label, bonus }) => {
                const isActive = experience?.label === label;
                return (
                  <tr key={range} className={isActive ? 'bg-orange-900/30' : ''}>
                    <td className="border border-charcoal-700 px-2 py-1 font-mono">{range}</td>
                    <td className="border border-charcoal-700 px-2 py-1">{label}</td>
                    <td className={`border border-charcoal-700 px-2 py-1 font-mono ${isActive ? 'text-orange-400' : ''}`}>+{bonus}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      </section>

      {/* AP Budget Breakdown */}
      <section className="card flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-charcoal-500">
          AP Budget
        </h3>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <BudgetRow label="Base"            value={`+${apBudget.base}`} />
          <BudgetRow label="Year Bonus"      value={yearBonusLabel} />
          <BudgetRow label="Experience"      value={expLabel} />
          {apBudget.levelUpGains > 0 && (
            <BudgetRow label="Level-up Gains" value={`+${apBudget.levelUpGains}`} />
          )}
          <div className="col-span-2 border-t border-charcoal-700 my-1" />
          <BudgetRow label="Total AP"        value={apBudget.total} accent />
        </div>

        {apBudget.spent > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex justify-between text-xs text-charcoal-500">
              <span>Spent: {apBudget.spent}</span>
              <span>Remaining: {apBudget.remaining}</span>
            </div>
            <div className="h-2 rounded-full bg-charcoal-700 overflow-hidden">
              <div
                className="h-full bg-orange-600 transition-all duration-300"
                style={{ width: `${Math.min(100, apBudget.total > 0 ? (apBudget.spent / apBudget.total) * 100 : 0)}%` }}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

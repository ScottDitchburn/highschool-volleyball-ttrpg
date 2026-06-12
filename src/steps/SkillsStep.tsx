// SkillsStep -- ten 4d4-averaged rolls -> assign across ten skill stats

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCharacter } from '../state/characterStore';
import { RollPool, type SlotDef } from '../components/RollPool';
import { DiceRoller } from '../components/DiceRoller';
import { SKILL_STAT_NAMES, type SkillStat, type SkillRoll } from '../types';

const SKILL_SLOTS: SlotDef[] = SKILL_STAT_NAMES.map((name) => ({
  id: name,
  label: name,
}));

const POOL_SIZE = 10;

/** Roll one 4d4 -> returns average value and the four dice */
function rollSkillChip(): { value: number; dice: [number, number, number, number] } {
  const arr = new Uint32Array(4);
  crypto.getRandomValues(arr);
  const dice: [number, number, number, number] = [
    (arr[0] % 4) + 1,
    (arr[1] % 4) + 1,
    (arr[2] % 4) + 1,
    (arr[3] % 4) + 1,
  ];
  const sum = dice[0] + dice[1] + dice[2] + dice[3];
  const value = Math.round((sum / 4) * 100) / 100; // step 0.25
  return { value, dice };
}

export function SkillsStep() {
  const { character, dispatch } = useCharacter();
  const { skillPool, skills } = character;

  // Local chip values and dice -- initialise from store
  const [chipValues, setChipValues] = useState<(number | null)[]>(() =>
    skillPool.rolls.map((r) => r?.value ?? null)
  );
  const [chipDiceArrays, setChipDiceArrays] = useState<(number[] | null)[]>(() =>
    skillPool.rolls.map((r) => (r ? Array.from(r.dice) : null))
  );

  // assignments: slotId (skill stat name) -> chipIndex
  const [assignments, setAssignments] = useState<Record<string, number>>(() => {
    if (!skills) return {};
    const result: Record<string, number> = {};
    const usedChips = new Set<number>();
    for (const stat of SKILL_STAT_NAMES) {
      const v = skills[stat];
      if (v === undefined) continue;
      const idx = skillPool.rolls.findIndex(
        (r, i) => r !== null && r.value === v && !usedChips.has(i)
      );
      if (idx !== -1) {
        result[stat] = idx;
        usedChips.add(idx);
      }
    }
    return result;
  });

  // Sync assignments to store on each change
  const prevAssignmentsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const prev = prevAssignmentsRef.current;
    for (const [slotId, chipIdx] of Object.entries(assignments)) {
      if (prev[slotId] !== chipIdx) {
        const val = chipValues[chipIdx];
        if (val !== null) {
          dispatch({ type: 'ASSIGN_SKILL', index: chipIdx, stat: slotId as SkillStat });
        }
      }
    }
    for (const slotId of Object.keys(prev)) {
      if (!(slotId in assignments)) {
        dispatch({ type: 'CLEAR_SKILL_ASSIGNMENT', stat: slotId as SkillStat });
      }
    }
    prevAssignmentsRef.current = { ...assignments };
  }, [assignments, chipValues, dispatch]);

  const handleRerollAll = useCallback(() => {
    const newValues: (number | null)[] = [];
    const newDice: (number[] | null)[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const { value, dice } = rollSkillChip();
      newValues.push(value);
      newDice.push(Array.from(dice));
      const roll: SkillRoll = { dice, value };
      dispatch({ type: 'SET_SKILL_ROLL', index: i, roll });
    }
    setChipValues(newValues);
    setChipDiceArrays(newDice);
    setAssignments({});
  }, [dispatch]);

  const handleAssign = useCallback((slotId: string, chipIndex: number) => {
    setAssignments((prev) => {
      const next = { ...prev };
      for (const [sid, idx] of Object.entries(next)) {
        if (idx === chipIndex) delete next[sid];
      }
      next[slotId] = chipIndex;
      return next;
    });
  }, []);

  const handleUnassign = useCallback((slotId: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }, []);

  // Per-chip DiceRoller callback factory
  const makeHandleResult = useCallback(
    (chipIndex: number) => (value: number, dice: number[]) => {
      const roll: SkillRoll = {
        dice: (dice.length === 4 ? dice : [1, 1, 1, 1]) as [number, number, number, number],
        value,
      };
      setChipValues((prev) => { const n = [...prev]; n[chipIndex] = value; return n; });
      setChipDiceArrays((prev) => { const n = [...prev]; n[chipIndex] = dice; return n; });
      dispatch({ type: 'SET_SKILL_ROLL', index: chipIndex, roll });
      setAssignments((prev) => {
        const slot = Object.entries(prev).find(([, i]) => i === chipIndex)?.[0];
        if (slot) { const n = { ...prev }; delete n[slot]; return n; }
        return prev;
      });
    },
    [dispatch]
  );

  const assignedCount = Object.keys(assignments).length;
  const allRolled = chipValues.every((v) => v !== null);
  const allAssigned = assignedCount === POOL_SIZE;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-orange-400 mb-1">Skill Stats</h2>
        <p className="text-charcoal-400 text-sm">
          Roll ten pools of 4d4. Each result is averaged (1.00--4.00, steps of 0.25).
          Assign each value to one of the ten skill stats.
          Drag chips into slots, tap a chip then tap a slot, or use the dropdowns.
        </p>
      </div>

      {/* Individual die rollers in a compact grid */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-charcoal-300">Individual Chip Rolls</span>
          <button
            type="button"
            onClick={handleRerollAll}
            className="btn-ghost text-xs py-1 px-3"
            aria-label="Roll all ten skill chips at once"
          >
            Roll All 10
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Array.from({ length: POOL_SIZE }, (_, i) => (
            <div key={i} className="card p-2 flex flex-col gap-1">
              <span className="text-xs text-charcoal-500 font-bold uppercase">Chip {i + 1}</span>
              <DiceRoller
                numDice={4}
                sides={4}
                mode="average"
                onResult={makeHandleResult(i)}
                initialDice={chipDiceArrays[i] ?? undefined}
                initialValue={chipValues[i] ?? undefined}
              />
            </div>
          ))}
        </div>
      </div>

      {/* RollPool assignment panel */}
      <div className="card">
        <RollPool
          poolSize={POOL_SIZE}
          slots={SKILL_SLOTS}
          formatValue={(v) => v.toFixed(2)}
          formatSlotValue={(v) => v.toFixed(2)}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onRerollAll={handleRerollAll}
          assignments={assignments}
          chipValues={chipValues}
        />
      </div>

      {/* Status summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-charcoal-400">
          {assignedCount} / {POOL_SIZE} assigned
        </span>
        {allAssigned && (
          <span className="text-orange-400 font-bold">All stats assigned!</span>
        )}
        {!allRolled && !allAssigned && (
          <span className="text-charcoal-500 italic">Roll all chips first</span>
        )}
      </div>

      {/* Assigned stats summary table */}
      {assignedCount > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold text-charcoal-300 mb-3 uppercase tracking-wide">
            Assigned Stats
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SKILL_STAT_NAMES.map((stat) => {
              const chipIdx = assignments[stat];
              const value   = chipIdx !== undefined ? chipValues[chipIdx] : null;
              return (
                <div
                  key={stat}
                  className={
                    value !== null
                      ? 'flex items-center justify-between px-3 py-2 rounded-lg bg-charcoal-800 border border-charcoal-600'
                      : 'flex items-center justify-between px-3 py-2 rounded-lg bg-charcoal-900 border border-charcoal-800 border-dashed'
                  }
                >
                  <span className="text-sm text-charcoal-300">{stat}</span>
                  <span className={
                    value !== null
                      ? 'text-base font-black text-orange-400'
                      : 'text-base font-black text-charcoal-600'
                  }>
                    {value !== null ? value.toFixed(2) : '--'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

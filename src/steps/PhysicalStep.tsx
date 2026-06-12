// PhysicalStep -- two 3d10 rolls -> pool -> assign to Height / Vertical Jump
// Displays Physical distribution charts for each assigned attribute.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCharacter } from '../state/characterStore';
import { DiceRoller } from '../components/DiceRoller';
import { RollPool, type SlotDef } from '../components/RollPool';
import { DistributionChart } from '../charts/DistributionChart';
import {
  heightCmPmf,
  verticalCmPmf,
} from '../charts/distributions';
import { rollToHeightCm, rollToVerticalCm, type PhysicalRoll } from '../types';

// Crypto-random 3d10
function rollPhysical(): PhysicalRoll {
  const arr = new Uint32Array(3);
  crypto.getRandomValues(arr);
  const dice: [number, number, number] = [
    (arr[0] % 10) + 1,
    (arr[1] % 10) + 1,
    (arr[2] % 10) + 1,
  ];
  return { dice, total: dice[0] + dice[1] + dice[2] };
}

// Static PMFs computed once
const heightPmf   = heightCmPmf();
const verticalPmf = verticalCmPmf();

const PHYSICAL_SLOTS: SlotDef[] = [
  { id: 'height',   label: 'Height',        sublabel: '(3d10 x 2 + 150 cm)' },
  { id: 'vertical', label: 'Vertical Jump',  sublabel: '(3d10 x 3 + 45 cm)' },
];

export function PhysicalStep() {
  const { character, dispatch } = useCharacter();
  const { physicalPool, physical } = character;
  const seeded = character.seeded;

  // Local state: chip values and per-chip dice arrays
  const [chipValues, setChipValues] = useState<(number | null)[]>([
    physicalPool.rollA?.total ?? null,
    physicalPool.rollB?.total ?? null,
  ]);
  const [chipDice, setChipDice] = useState<(number[] | null)[]>([
    physicalPool.rollA?.dice ? Array.from(physicalPool.rollA.dice) : null,
    physicalPool.rollB?.dice ? Array.from(physicalPool.rollB.dice) : null,
  ]);

  // assignments: slotId -> chipIndex
  const [assignments, setAssignments] = useState<Record<string, number>>(() => {
    if (!physical) return {};
    const result: Record<string, number> = {};
    if (physicalPool.rollA && physicalPool.rollA.total === physical.heightRoll) {
      result['height'] = 0;
    } else if (physicalPool.rollB && physicalPool.rollB.total === physical.heightRoll) {
      result['height'] = 1;
    }
    const hIdx = result['height'];
    if (physicalPool.rollA && physicalPool.rollA.total === physical.verticalRoll && hIdx !== 0) {
      result['vertical'] = 0;
    } else if (physicalPool.rollB && physicalPool.rollB.total === physical.verticalRoll && hIdx !== 1) {
      result['vertical'] = 1;
    }
    return result;
  });

  // Sync assignments to store whenever both slots are filled
  const prevAssignmentsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const prev = prevAssignmentsRef.current;
    const heightIdx   = assignments['height'];
    const verticalIdx = assignments['vertical'];
    const heightChanged   = heightIdx   !== prev['height'];
    const verticalChanged = verticalIdx !== prev['vertical'];

    if ((heightChanged || verticalChanged) &&
        heightIdx !== undefined && verticalIdx !== undefined) {
      const heightRoll   = chipValues[heightIdx];
      const verticalRoll = chipValues[verticalIdx];
      if (heightRoll !== null && verticalRoll !== null) {
        dispatch({ type: 'ASSIGN_PHYSICAL', heightRoll, verticalRoll });
      }
    }
    prevAssignmentsRef.current = assignments;
  }, [assignments, chipValues, dispatch]);

  const handleResultA = useCallback(
    (total: number, dice: number[]) => {
      const rollObj: PhysicalRoll = {
        dice: (dice.length === 3 ? dice : [1, 1, 1]) as [number, number, number],
        total,
      };
      setChipValues((prev) => { const n = [...prev]; n[0] = total; return n; });
      setChipDice((prev)   => { const n = [...prev]; n[0] = dice;  return n; });
      dispatch({ type: 'SET_PHYSICAL_ROLL_A', roll: rollObj });
      setAssignments((prev) => {
        const slot = Object.entries(prev).find(([, i]) => i === 0)?.[0];
        if (slot) { const n = { ...prev }; delete n[slot]; return n; }
        return prev;
      });
    },
    [dispatch]
  );

  const handleResultB = useCallback(
    (total: number, dice: number[]) => {
      const rollObj: PhysicalRoll = {
        dice: (dice.length === 3 ? dice : [1, 1, 1]) as [number, number, number],
        total,
      };
      setChipValues((prev) => { const n = [...prev]; n[1] = total; return n; });
      setChipDice((prev)   => { const n = [...prev]; n[1] = dice;  return n; });
      dispatch({ type: 'SET_PHYSICAL_ROLL_B', roll: rollObj });
      setAssignments((prev) => {
        const slot = Object.entries(prev).find(([, i]) => i === 1)?.[0];
        if (slot) { const n = { ...prev }; delete n[slot]; return n; }
        return prev;
      });
    },
    [dispatch]
  );

  const handleRerollAll = useCallback(() => {
    const rollA = rollPhysical();
    const rollB = rollPhysical();
    setChipValues([rollA.total, rollB.total]);
    setChipDice([Array.from(rollA.dice), Array.from(rollB.dice)]);
    setAssignments({});
    dispatch({ type: 'SET_PHYSICAL_ROLL_A', roll: rollA });
    dispatch({ type: 'SET_PHYSICAL_ROLL_B', roll: rollB });
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

  // Derived display values
  const heightChipIdx   = assignments['height'];
  const verticalChipIdx = assignments['vertical'];
  const heightRoll      = heightChipIdx   !== undefined ? chipValues[heightChipIdx]   : null;
  const verticalRoll    = verticalChipIdx !== undefined ? chipValues[verticalChipIdx] : null;
  const heightCm        = heightRoll   !== null ? rollToHeightCm(heightRoll)   : null;
  const verticalCm      = verticalRoll !== null ? rollToVerticalCm(verticalRoll) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-orange-400 mb-1">Physical Attributes</h2>
        <p className="text-charcoal-400 text-sm">
          Roll two pools of 3d10. Assign one result to <strong className="text-charcoal-200">Height</strong> and
          one to <strong className="text-charcoal-200">Vertical Jump</strong>.
          Drag chips into slots, or tap a chip then tap a slot.
        </p>
      </div>

      {/* Two dice rollers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DiceRoller
          numDice={3}
          sides={10}
          mode="sum"
          label="Pool Roll A"
          onResult={handleResultA}
          initialDice={chipDice[0] ?? undefined}
          initialValue={chipValues[0] ?? undefined}
          locked={seeded}
        />
        <DiceRoller
          numDice={3}
          sides={10}
          mode="sum"
          label="Pool Roll B"
          onResult={handleResultB}
          initialDice={chipDice[1] ?? undefined}
          initialValue={chipValues[1] ?? undefined}
          locked={seeded}
        />
      </div>

      {/* Roll Pool + Assignment */}
      <div className="card">
        <RollPool
          poolSize={2}
          slots={PHYSICAL_SLOTS}
          formatValue={(v) => String(v)}
          formatSlotValue={(v) => {
            if (heightChipIdx !== undefined && chipValues[heightChipIdx] === v)
              return v + ' -> ' + rollToHeightCm(v) + ' cm';
            if (verticalChipIdx !== undefined && chipValues[verticalChipIdx] === v)
              return v + ' -> ' + rollToVerticalCm(v) + ' cm';
            return String(v);
          }}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onRerollAll={handleRerollAll}
          assignments={assignments}
          chipValues={chipValues}
          locked={seeded}
        />
      </div>

      {/* Assignment summary */}
      {(heightCm !== null || verticalCm !== null) && (
        <div className="card grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xs text-charcoal-500 uppercase tracking-wide mb-1">Height</div>
            <div className="text-2xl font-black text-orange-400">
              {heightCm !== null ? heightCm + ' cm' : '--'}
            </div>
            {heightRoll !== null && (
              <div className="text-xs text-charcoal-500">Roll: {heightRoll}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-charcoal-500 uppercase tracking-wide mb-1">Vertical Jump</div>
            <div className="text-2xl font-black text-orange-400">
              {verticalCm !== null ? verticalCm + ' cm' : '--'}
            </div>
            {verticalRoll !== null && (
              <div className="text-xs text-charcoal-500">Roll: {verticalRoll}</div>
            )}
          </div>
        </div>
      )}

      {/* Distribution charts */}
      <div className="flex flex-col gap-4">
        <DistributionChart
          pmf={heightPmf}
          markerValue={heightCm}
          label="Height Distribution (cm)"
          unit=" cm"
          markerLabel={heightCm !== null ? heightCm + ' cm' : undefined}
        />
        <DistributionChart
          pmf={verticalPmf}
          markerValue={verticalCm}
          label="Vertical Jump Distribution (cm)"
          unit=" cm"
          markerLabel={verticalCm !== null ? verticalCm + ' cm' : undefined}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RollPool — generic "roll a pool of N values, assign each to labelled slots"
//
// Props:
//   poolSize          — number of chips in the pool (e.g. 2 for Physical, 10 for Skills)
//   slots             — array of slot definitions (id + label)
//   rollOneDice       — fn that rolls one chip value: returns { value, dice }
//   formatValue       — optional fn to format chip value for display (default: toString)
//   formatSlotValue   — optional fn to format the assigned value in a slot
//   onAssign          — (slotId: string, chipIndex: number, value: number) => void
//   onUnassign        — (slotId: string) => void
//   onRerollAll       — called when "Re-roll all" clicked
//   assignments       — map from slotId → chipIndex (controlled)
//   chipValues        — array of already-rolled values (length = poolSize, null = not yet rolled)
//   chipDice          — array of dice arrays per chip (for display)
//   disabled          — disables all interaction
//   allowPartialRoll  — if true, show individual roll buttons per chip; if false only bulk re-roll
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'react';

export interface SlotDef {
  id: string;
  label: string;
  /** Optional sub-label shown below main label */
  sublabel?: string;
}

export interface RollPoolProps {
  poolSize: number;
  slots: SlotDef[];
  formatValue?: (v: number) => string;
  formatSlotValue?: (v: number) => string;
  onAssign: (slotId: string, chipIndex: number) => void;
  onUnassign: (slotId: string) => void;
  onRerollAll: () => void;
  /** slotId → chipIndex */
  assignments: Record<string, number>;
  /** null means the chip hasn't been rolled yet */
  chipValues: (number | null)[];
  disabled?: boolean;
}

interface ChipState {
  index: number;
  value: number;
}

export function RollPool({
  poolSize: _poolSize,
  slots,
  formatValue = (v) => String(v),
  formatSlotValue,
  onAssign,
  onUnassign,
  onRerollAll,
  assignments,
  chipValues,
  disabled = false,
}: RollPoolProps) {
  // id reserved for future aria-labelledby use

  // Touch-assign state: first tap selects a chip, second tap (on slot) assigns
  const [selectedChip, setSelectedChip] = useState<number | null>(null);

  // Drag state
  const draggingChipRef = useRef<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // Which chip indices are already assigned somewhere
  const assignedChipIndices = new Set(Object.values(assignments));

  const unassignedChips: ChipState[] = chipValues
    .map((v, i) => (v !== null && !assignedChipIndices.has(i) ? { index: i, value: v } : null))
    .filter((c): c is ChipState => c !== null);

  const handleChipClick = useCallback(
    (chipIndex: number) => {
      if (disabled) return;
      if (selectedChip === chipIndex) {
        // Deselect
        setSelectedChip(null);
      } else {
        setSelectedChip(chipIndex);
      }
    },
    [disabled, selectedChip]
  );

  const handleSlotClick = useCallback(
    (slotId: string) => {
      if (disabled) return;
      if (selectedChip !== null) {
        onAssign(slotId, selectedChip);
        setSelectedChip(null);
      } else {
        // If slot already has assignment, clear it
        if (assignments[slotId] !== undefined) {
          onUnassign(slotId);
        }
      }
    },
    [disabled, selectedChip, onAssign, onUnassign, assignments]
  );

  const handleDropdownChange = useCallback(
    (slotId: string, chipIndexStr: string) => {
      if (chipIndexStr === '') {
        onUnassign(slotId);
      } else {
        onAssign(slotId, parseInt(chipIndexStr, 10));
      }
    },
    [onAssign, onUnassign]
  );

  // Drag handlers
  const handleDragStart = useCallback(
    (chipIndex: number, e: React.DragEvent) => {
      draggingChipRef.current = chipIndex;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(chipIndex));
    },
    []
  );

  const handleDragOver = useCallback(
    (slotId: string, e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverSlot(slotId);
    },
    []
  );

  const handleDrop = useCallback(
    (slotId: string, e: React.DragEvent) => {
      e.preventDefault();
      const chipIndex = draggingChipRef.current ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(chipIndex)) {
        onAssign(slotId, chipIndex);
      }
      draggingChipRef.current = null;
      setDragOverSlot(null);
    },
    [onAssign]
  );

  const handleDragEnd = useCallback(() => {
    draggingChipRef.current = null;
    setDragOverSlot(null);
  }, []);

  const allRolled = chipValues.every((v) => v !== null);

  return (
    <div className="flex flex-col gap-4">
      {/* Pool chips */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-charcoal-400">
            Pool ({unassignedChips.length} unassigned)
          </span>
          <button
            type="button"
            onClick={onRerollAll}
            disabled={disabled}
            className="btn-ghost text-xs py-1 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Re-roll all pool values"
          >
            Re-roll All
          </button>
        </div>

        <div
          className="flex flex-wrap gap-2 min-h-[3rem] p-2 rounded-lg border border-charcoal-700 bg-charcoal-900/50"
          role="list"
          aria-label="Unassigned pool chips"
        >
          {!allRolled && (
            <span className="text-charcoal-600 text-sm self-center italic">
              Roll dice above to fill the pool
            </span>
          )}
          {unassignedChips.map(({ index, value }) => {
            const isSelected = selectedChip === index;
            return (
              <button
                key={index}
                type="button"
                role="listitem"
                draggable={!disabled}
                onClick={() => handleChipClick(index)}
                onDragStart={(e) => handleDragStart(index, e)}
                onDragEnd={handleDragEnd}
                disabled={disabled}
                aria-pressed={isSelected}
                aria-label={`Pool chip ${index + 1}: ${formatValue(value)}${isSelected ? ' (selected — tap a slot to assign)' : ''}`}
                className={`
                  inline-flex items-center justify-center
                  px-3 py-1.5 rounded-full text-sm font-bold
                  cursor-grab active:cursor-grabbing
                  transition-all duration-150 select-none
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${isSelected
                    ? 'bg-orange-500 text-white ring-2 ring-orange-300 scale-105'
                    : 'bg-charcoal-700 text-charcoal-100 hover:bg-orange-700 hover:text-white'
                  }
                `}
              >
                {formatValue(value)}
              </button>
            );
          })}
        </div>

        {selectedChip !== null && (
          <p className="text-xs text-orange-400 text-center" role="status" aria-live="polite">
            Chip selected: <strong>{formatValue(chipValues[selectedChip] ?? 0)}</strong> — tap a slot to assign, or tap the chip again to deselect
          </p>
        )}
      </div>

      {/* Slots */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-charcoal-400">
          Assignment Slots
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {slots.map((slot) => {
            const assignedIdx = assignments[slot.id];
            const assignedValue = assignedIdx !== undefined ? chipValues[assignedIdx] : null;
            const isDragOver = dragOverSlot === slot.id;
            const isTargetable = selectedChip !== null && assignedIdx === undefined;

            return (
              <div
                key={slot.id}
                role="button"
                tabIndex={0}
                aria-label={`${slot.label} slot${assignedValue !== null && assignedValue !== undefined ? `: assigned ${formatSlotValue ? formatSlotValue(assignedValue) : formatValue(assignedValue)}` : ': empty'}`}
                onClick={() => handleSlotClick(slot.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSlotClick(slot.id)}
                onDragOver={(e) => handleDragOver(slot.id, e)}
                onDrop={(e) => handleDrop(slot.id, e)}
                onDragLeave={() => setDragOverSlot(null)}
                className={`
                  flex items-center justify-between
                  p-3 rounded-lg border transition-all duration-150
                  cursor-pointer select-none
                  ${isDragOver
                    ? 'border-orange-400 bg-orange-900/30'
                    : isTargetable
                    ? 'border-orange-600/60 bg-charcoal-800 ring-1 ring-orange-600/40'
                    : assignedValue !== null && assignedValue !== undefined
                    ? 'border-charcoal-600 bg-charcoal-800'
                    : 'border-charcoal-700 bg-charcoal-900/50 border-dashed'
                  }
                `}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-charcoal-200">{slot.label}</span>
                  {slot.sublabel && (
                    <span className="text-xs text-charcoal-500">{slot.sublabel}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {assignedValue !== null && assignedValue !== undefined ? (
                    <>
                      <span className="text-lg font-black text-orange-400">
                        {formatSlotValue ? formatSlotValue(assignedValue) : formatValue(assignedValue)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onUnassign(slot.id); }}
                        className="text-charcoal-500 hover:text-red-400 transition-colors text-sm leading-none p-0.5"
                        aria-label={`Remove assignment from ${slot.label}`}
                        title="Remove assignment"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className="text-charcoal-600 text-xs italic">empty</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dropdown fallback — always visible for accessibility */}
      <details className="text-xs text-charcoal-500">
        <summary className="cursor-pointer hover:text-charcoal-300 select-none">
          Use dropdowns to assign (accessibility fallback)
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {slots.map((slot) => {
            const currentIdx = assignments[slot.id];
            return (
              <label key={slot.id} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-charcoal-400">{slot.label}:</span>
                <select
                  value={currentIdx !== undefined ? String(currentIdx) : ''}
                  onChange={(e) => handleDropdownChange(slot.id, e.target.value)}
                  disabled={disabled}
                  aria-label={`Assign pool chip to ${slot.label}`}
                  className="flex-1 bg-charcoal-800 border border-charcoal-600 rounded px-2 py-1
                             text-charcoal-200 text-xs focus:outline-none focus:border-orange-600
                             disabled:opacity-40"
                >
                  <option value="">— unassigned —</option>
                  {chipValues.map((v, i) => {
                    if (v === null) return null;
                    // Show only if unassigned or already assigned to this slot
                    const occupiedBy = Object.entries(assignments).find(([, idx]) => idx === i)?.[0];
                    if (occupiedBy && occupiedBy !== slot.id) return null;
                    return (
                      <option key={i} value={String(i)}>
                        Chip {i + 1}: {formatValue(v)}
                      </option>
                    );
                  })}
                </select>
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}

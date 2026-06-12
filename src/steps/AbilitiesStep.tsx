// AbilitiesStep -- Milestone 5: Live prereq/AP engine + ability grid

import { useMemo, useState } from 'react';
import { useCharacter } from '../state/characterStore';
import { ABILITIES, ABILITY_MAP } from '../data/abilities';
import type { SkillStat } from '../types';
import { apIncomeTotal, computeSpent, apRemaining } from '../engine/apEngine';
import { evaluateAbility, findCascadeDependents, cumulativeCost } from '../engine/prereqEngine';
import { AbilityCard } from '../components/AbilityCard';

// ---------------------------------------------------------------------------
// AP Meter
// ---------------------------------------------------------------------------

function APMeter({ spent, total }: { spent: number; total: number }) {
  const remaining = total - spent;
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  const isOver = remaining < 0;

  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-bold text-charcoal-200">Ability Points</span>
        <div className="flex items-center gap-3 text-sm font-mono">
          <span className="text-charcoal-400">{spent} spent</span>
          <span className="text-charcoal-600">/</span>
          <span className="text-charcoal-200">{total} total</span>
          <span className={`font-black text-base ${isOver ? 'text-red-400' : 'text-orange-400'}`}>
            {remaining} left
          </span>
        </div>
      </div>
      <div className="h-3 rounded-full bg-charcoal-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-red-600' : 'bg-orange-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cascade warning modal
// ---------------------------------------------------------------------------

interface CascadeWarning {
  targetName: string;
  newTier: number | null;
  dependents: Array<{ uid: string; abilityId: string; name: string; reason: string }>;
}

function CascadeModal({
  warning,
  onConfirm,
  onCancel,
}: {
  warning: CascadeWarning;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="card max-w-md w-full flex flex-col gap-4 border-red-700">
        <h3 className="text-lg font-bold text-red-400">Cascade Warning</h3>
        <p className="text-charcoal-300 text-sm">
          {warning.newTier === null
            ? <span>Removing <strong className="text-charcoal-100">{warning.targetName}</strong> will break:</span>
            : <span>Lowering <strong className="text-charcoal-100">{warning.targetName}</strong> will break:</span>
          }
        </p>
        <ul className="flex flex-col gap-2">
          {warning.dependents.map((d) => (
            <li key={d.uid} className="bg-charcoal-800 rounded-lg p-3 flex flex-col gap-1">
              <span className="font-semibold text-charcoal-100 text-sm">{d.name}</span>
              <span className="text-xs text-red-400">{d.reason}</span>
            </li>
          ))}
        </ul>
        <p className="text-charcoal-500 text-xs">
          These abilities will be automatically removed if you confirm.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-ghost text-sm py-1.5 px-3">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-sm px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold transition-colors"
          >
            Confirm and Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main step
// ---------------------------------------------------------------------------

type FilterMode = 'all' | 'available' | 'selected';

export function AbilitiesStep() {
  const { character, dispatch, effectiveStats, derivedReaches } = useCharacter();
  const [cascadeWarning, setCascadeWarning] = useState<CascadeWarning | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');

  const income = apIncomeTotal(character);
  const spent = computeSpent(character);
  const remaining = apRemaining(character);

  // Evaluate all abilities against current character state.
  // We evaluate "next purchase" affordability (each new instance costs its full baseCost).
  const evaluations = useMemo(() => {
    return ABILITIES.map((ability) => {
      const instances = character.selectedAbilities.filter((s) => s.abilityId === ability.id);
      const isSelected = instances.length > 0;
      // For evaluation cost: use tier 1 for tiered abilities, 0 otherwise
      const initialTier = ability.tiers && ability.tiers.length > 0 ? 1 : 0;
      return {
        ability,
        evaluation: evaluateAbility(ability, character, effectiveStats, derivedReaches, initialTier),
        isSelected,
        instances,
      };
    });
  }, [character, effectiveStats, derivedReaches]);

  const availableCount = evaluations.filter((e) => e.evaluation.eligible && !e.evaluation.maxedOut && !e.isSelected).length;
  const selectedCount = character.selectedAbilities.length;

  const visibleEvaluations = useMemo(() => {
    if (filter === 'available') return evaluations.filter((e) => e.evaluation.eligible && !e.evaluation.maxedOut && !e.isSelected);
    if (filter === 'selected') return evaluations.filter((e) => e.isSelected);
    return evaluations;
  }, [evaluations, filter]);

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  function handleSelect(abilityId: string) {
    const ability = ABILITY_MAP[abilityId];
    if (!ability) return;
    const initialTier = ability.tiers && ability.tiers.length > 0 ? 1 : 0;
    const ev = evaluateAbility(ability, character, effectiveStats, derivedReaches, initialTier);
    if (!ev.eligible || !ev.affordable) return;
    dispatch({ type: 'SELECT_ABILITY', abilityId });
  }

  function executeDeselect(uid: string, dependents: Array<{ uid: string; abilityId: string; name: string; reason: string }>) {
    for (const dep of dependents) {
      dispatch({ type: 'DESELECT_ABILITY', uid: dep.uid });
    }
    dispatch({ type: 'DESELECT_ABILITY', uid });
  }

  function handleDeselect(uid: string) {
    const sel = character.selectedAbilities.find((s) => s.uid === uid);
    if (!sel) return;
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability) return;
    const dependents = findCascadeDependents(uid, null, character, effectiveStats, derivedReaches);
    if (dependents.length > 0) {
      setPendingAction(() => () => executeDeselect(uid, dependents));
      setCascadeWarning({ targetName: ability.name, newTier: null, dependents });
    } else {
      executeDeselect(uid, []);
    }
  }

  function executeTierChange(uid: string, newTier: number, dependents: Array<{ uid: string; abilityId: string; name: string; reason: string }>) {
    for (const dep of dependents) {
      dispatch({ type: 'DESELECT_ABILITY', uid: dep.uid });
    }
    dispatch({ type: 'SET_ABILITY_TIER', uid, tier: newTier });
  }

  function handleTierChange(uid: string, newTier: number) {
    const sel = character.selectedAbilities.find((s) => s.uid === uid);
    if (!sel) return;
    const ability = ABILITY_MAP[sel.abilityId];
    if (!ability) return;

    const currentTier = sel.tier;

    if (newTier < currentTier) {
      // Lowering tier: check for cascade
      const dependents = findCascadeDependents(uid, newTier, character, effectiveStats, derivedReaches);
      if (dependents.length > 0) {
        setPendingAction(() => () => executeTierChange(uid, newTier, dependents));
        setCascadeWarning({ targetName: ability.name, newTier, dependents });
      } else {
        executeTierChange(uid, newTier, []);
      }
      return;
    }

    // Raising tier: check affordability (no AP debt)
    const newCost = cumulativeCost(ability, newTier);
    const currentCost = cumulativeCost(ability, currentTier);
    const extra = newCost - currentCost;
    if (extra > remaining) return;

    dispatch({ type: 'SET_ABILITY_TIER', uid, tier: newTier });
  }

  function handleChooserChange(uid: string, effectIndex: number, choice: SkillStat | SkillStat[]) {
    dispatch({ type: 'SET_ABILITY_CHOOSER', uid, effectIndex, choice });
  }

  function handleCascadeConfirm() {
    if (pendingAction) pendingAction();
    setCascadeWarning(null);
    setPendingAction(null);
  }

  function handleCascadeCancel() {
    setCascadeWarning(null);
    setPendingAction(null);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-orange-400 mb-1">Abilities</h2>
        <p className="text-charcoal-400 text-sm">
          Spend your Ability Points on abilities. Prereqs are validated live against your
          effective stats. Greyed-out abilities have unmet prereqs shown in red.
        </p>
      </div>

      <APMeter spent={spent} total={income} />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['all', `All (${ABILITIES.length})`],
          ['available', `Available (${availableCount})`],
          ['selected', `Selected (${selectedCount})`],
        ] as [FilterMode, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors
              ${filter === f
                ? 'border-orange-600 bg-orange-600/20 text-orange-400'
                : 'border-charcoal-700 text-charcoal-400 hover:border-charcoal-500'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Warnings */}
      {!character.skills && (
        <div className="card border-yellow-700 bg-yellow-900/20 text-yellow-300 text-sm">
          Complete the <strong>Skills</strong> step first to enable stat-gated ability prereqs.
        </div>
      )}
      {!character.physical && character.skills && (
        <div className="card border-yellow-700 bg-yellow-900/20 text-yellow-300 text-sm">
          Abilities with <strong>reach</strong> prereqs (Double Jump, Standing Block) require
          Physical Attributes to be assigned.
        </div>
      )}

      {/* Ability grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleEvaluations.map(({ ability, evaluation, isSelected, instances }) => (
          <AbilityCard
            key={ability.id}
            ability={ability}
            evaluation={evaluation}
            isSelected={isSelected}
            instances={instances}
            apRemaining={remaining}
            onSelect={() => handleSelect(ability.id)}
            onDeselect={(uid) => handleDeselect(uid)}
            onTierChange={(uid, tier) => handleTierChange(uid, tier)}
            onChooserChange={(uid, effectIndex, choice) => handleChooserChange(uid, effectIndex, choice)}
          />
        ))}
      </div>

      {visibleEvaluations.length === 0 && (
        <div className="card text-charcoal-400 italic text-center py-8">
          No abilities match the current filter.
        </div>
      )}

      {cascadeWarning && (
        <CascadeModal
          warning={cascadeWarning}
          onConfirm={handleCascadeConfirm}
          onCancel={handleCascadeCancel}
        />
      )}
    </div>
  );
}

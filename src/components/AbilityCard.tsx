// src/components/AbilityCard.tsx
// Single ability card for the Abilities grid.
// Handles: prereq display, tier selector, AP cost, chooser selectors.
// Supports multi-instance (repeatable) abilities via per-instance controls.

import type { Ability, SelectedAbility, SkillStat } from '../types';
import { SKILL_STAT_NAMES } from '../types';
import type { AbilityEvaluation, PrereqResult } from '../engine/prereqEngine';
import { cumulativeCost } from '../engine/prereqEngine';
import { toRomanNumeral } from '../utils/roman';

// ---------------------------------------------------------------------------
// Chooser options
// ---------------------------------------------------------------------------

/** Returns the list of stat options for a chooser effect on a given ability + effectIndex */
export function getChooserOptions(
  abilityId: string,
  _effectIndex: number,
  choose: 'any' | 'twoSkills' | ['Dig', 'Block'],
): SkillStat[] {
  // Special case: aggressive-spiker's penalty is encoded as ['Dig','Block'] but should be Stamina/IQ
  if (abilityId === 'aggressive-spiker') {
    return ['Stamina', 'IQ'];
  }
  if (Array.isArray(choose)) {
    return choose as SkillStat[];
  }
  // 'any' or 'twoSkills' → all 10 stats
  return SKILL_STAT_NAMES as unknown as SkillStat[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PrereqPill({ result }: { result: PrereqResult }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border
        ${result.met
          ? 'border-green-700 bg-green-900/30 text-green-300'
          : 'border-red-700 bg-red-900/30 text-red-300'
        }`}
      title={result.label}
    >
      <span className={result.met ? 'text-green-400' : 'text-red-400'}>{result.met ? '✓' : '✗'}</span>
      <span className="truncate max-w-[16rem]">{result.label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AbilityCardProps {
  ability: Ability;
  evaluation: AbilityEvaluation;
  isSelected: boolean;
  instances: SelectedAbility[];
  apRemaining: number;
  onSelect: () => void;
  onDeselect: (uid: string) => void;
  onTierChange: (uid: string, tier: number) => void;
  onChooserChange: (uid: string, effectIndex: number, choice: SkillStat | SkillStat[]) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AbilityCard({
  ability,
  evaluation,
  isSelected,
  instances,
  apRemaining,
  onSelect,
  onDeselect,
  onTierChange,
  onChooserChange,
}: AbilityCardProps) {
  const { prereqResults, eligible, maxedOut, affordable } = evaluation;
  const hasTiers = (ability.tiers?.length ?? 0) > 0;
  const isRepeatable = ability.repeatable === true || (ability.maxTimes ?? 1) > 1;
  const purchaseCount = instances.length;

  // Can we add another instance?
  const canAddAnother = eligible && affordable && !maxedOut;
  // Unselected single-purchase ability
  const canSelectFirst = canAddAnother && !isSelected;

  // Disabled state: for non-repeatable this is the old logic; for repeatable, card is never fully disabled if any instance exists
  const disabled = !eligible || maxedOut || (!isSelected && !affordable);

  // Cost for next purchase
  const nextPurchaseTier = hasTiers ? 1 : 0;
  const nextPurchaseCost = cumulativeCost(ability, nextPurchaseTier);

  // Border color logic
  const borderClass = isSelected
    ? 'border-orange-500 shadow-[0_0_0_1px_theme(colors.orange.500)]'
    : disabled
      ? 'border-charcoal-700 opacity-60'
      : 'border-charcoal-600 hover:border-charcoal-500';

  // needsChooser: any instance missing a chooser
  const needsChooser = evaluation.needsChooser;

  return (
    <div
      className={`card flex flex-col gap-3 transition-all duration-150 ${borderClass} ${disabled && !isSelected ? 'cursor-not-allowed' : ''}`}
      aria-disabled={disabled && !isSelected}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold text-sm ${isSelected ? 'text-orange-300' : disabled ? 'text-charcoal-500' : 'text-charcoal-100'}`}>
              {ability.name}
            </span>
            {ability.meta?.map((m) => (
              <span key={m} className="text-xs px-1.5 py-0.5 rounded bg-charcoal-700 text-charcoal-400 font-mono uppercase tracking-wide">
                {m === 'creationOnly' ? 'Creation' : m === 'yearlyOnly' ? 'Yearly' : m === 'notFirstYear' ? '2nd/3rd Yr' : '3rd Yr'}
              </span>
            ))}
            {/* Repeatable badge showing max */}
            {isRepeatable && (ability.repeatable
              ? <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700">Uncapped</span>
              : <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700">×{ability.maxTimes} max</span>
            )}
            {maxedOut && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-charcoal-700 text-charcoal-500">
                Maxed
              </span>
            )}
            {isSelected && needsChooser && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700">
                Choose…
              </span>
            )}
          </div>
        </div>

        {/* Cost badge + select button (for single-purchase or "first" purchase) */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isSelected ? 'bg-orange-700/40 text-orange-300' : 'bg-charcoal-700 text-charcoal-300'}`}>
            {nextPurchaseCost} AP
          </span>
          {/* For non-repeatable: show toggle button. For repeatable: show "Add" button if not yet selected, or show purchase count. */}
          {!isRepeatable ? (
            isSelected ? (
              <button
                onClick={() => instances[0] && onDeselect(instances[0].uid)}
                className="text-xs px-2 py-1 rounded border border-charcoal-600 text-charcoal-400 hover:border-red-600 hover:text-red-400 transition-colors"
                aria-label={`Deselect ${ability.name}`}
              >
                Remove
              </button>
            ) : (
              <button
                onClick={canSelectFirst ? onSelect : undefined}
                disabled={!canSelectFirst}
                className={`text-xs px-2 py-1 rounded border transition-colors
                  ${canSelectFirst
                    ? 'border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white'
                    : 'border-charcoal-700 text-charcoal-600 cursor-not-allowed'
                  }`}
                aria-label={`Select ${ability.name}`}
              >
                {!eligible ? 'Locked' : !affordable ? 'No AP' : 'Select'}
              </button>
            )
          ) : (
            /* Repeatable ability: show count if any purchased */
            purchaseCount > 0 ? (
              <span className="text-xs font-semibold text-orange-400 font-mono">
                ×{purchaseCount} purchased
              </span>
            ) : null
          )}
        </div>
      </div>

      {/* Prereq pills */}
      {prereqResults.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {prereqResults.map((r, i) => (
            <PrereqPill key={i} result={r} />
          ))}
        </div>
      )}

      {/* Notes / description */}
      {ability.notes && (
        <p className="text-xs text-charcoal-500 leading-relaxed line-clamp-2" title={ability.notes}>
          {ability.notes}
        </p>
      )}

      {/* Per-instance controls (for each purchased instance) */}
      {instances.map((inst, instIdx) => (
        <InstanceControls
          key={inst.uid}
          ability={ability}
          instance={inst}
          instanceIndex={instIdx}
          totalInstances={purchaseCount}
          apRemaining={apRemaining}
          eligible={eligible}
          onDeselect={() => onDeselect(inst.uid)}
          onTierChange={(tier) => onTierChange(inst.uid, tier)}
          onChooserChange={(effectIndex, choice) => onChooserChange(inst.uid, effectIndex, choice)}
        />
      ))}

      {/* "Add another" button for repeatable abilities */}
      {isRepeatable && (
        <button
          onClick={canAddAnother ? onSelect : undefined}
          disabled={!canAddAnother}
          className={`text-xs px-3 py-1.5 rounded border transition-colors w-full text-center
            ${canAddAnother
              ? 'border-orange-600 text-orange-400 hover:bg-orange-600/20'
              : 'border-charcoal-700 text-charcoal-600 cursor-not-allowed'
            }`}
          aria-label={`Add another ${ability.name}`}
        >
          {!eligible
            ? `Locked — ${ability.name}`
            : maxedOut
              ? `Maxed (${purchaseCount}/${ability.maxTimes})`
              : !affordable
                ? `No AP (need ${nextPurchaseCost} AP)`
                : purchaseCount === 0
                  ? `Select — ${nextPurchaseCost} AP`
                  : `Add another — ${nextPurchaseCost} AP`
          }
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-instance controls sub-component
// ---------------------------------------------------------------------------

interface InstanceControlsProps {
  ability: Ability;
  instance: SelectedAbility;
  instanceIndex: number;
  totalInstances: number;
  apRemaining: number;
  eligible: boolean;
  onDeselect: () => void;
  onTierChange: (tier: number) => void;
  onChooserChange: (effectIndex: number, choice: SkillStat | SkillStat[]) => void;
}

function InstanceControls({
  ability,
  instance,
  instanceIndex,
  totalInstances,
  apRemaining,
  eligible,
  onDeselect,
  onTierChange,
  onChooserChange,
}: InstanceControlsProps) {
  const hasTiers = (ability.tiers?.length ?? 0) > 0;
  const isRepeatable = ability.repeatable === true || (ability.maxTimes ?? 1) > 1;

  function canAffordTier(tierIndex: number): boolean {
    const newCost = cumulativeCost(ability, tierIndex);
    const currentCost = cumulativeCost(ability, instance.tier);
    const extra = newCost - currentCost;
    return extra <= apRemaining;
  }

  // For single-purchase non-repeatable abilities, don't wrap in an extra box — controls are inline.
  // For repeatable abilities with multiple instances, wrap each in a labeled box.
  const label = isRepeatable && totalInstances > 1
    ? `Purchase ${instanceIndex + 1}`
    : null;

  return (
    <div className={`flex flex-col gap-2 ${isRepeatable ? 'bg-charcoal-800/40 rounded-lg p-2' : ''}`}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-charcoal-400 uppercase tracking-wide">{label}</span>
          <button
            onClick={onDeselect}
            className="text-xs px-2 py-0.5 rounded border border-charcoal-600 text-charcoal-400 hover:border-red-600 hover:text-red-400 transition-colors"
            aria-label={`Remove purchase ${instanceIndex + 1} of ${ability.name}`}
          >
            Remove
          </button>
        </div>
      )}

      {/* Remove button for non-repeatable single instance (shown inline) */}
      {!isRepeatable && (
        /* Already rendered in header — don't duplicate */
        null
      )}

      {/* Tier selector */}
      {hasTiers && (
        <TierSelector
          ability={ability}
          selectedTier={instance.tier}
          canAffordTier={canAffordTier}
          onTierChange={onTierChange}
          eligible={eligible}
        />
      )}

      {/* Chooser selectors */}
      {ability.effects?.map((effect, effectIndex) => {
        if (effect.kind !== 'statDelta' || !effect.choose) return null;
        const options = getChooserOptions(ability.id, effectIndex, effect.choose as 'any' | 'twoSkills' | ['Dig', 'Block']);
        const isTwoSkills = effect.choose === 'twoSkills';
        const currentChoice = instance.chooserSelections[effectIndex];

        return (
          <ChooserSelector
            key={effectIndex}
            abilityId={ability.id}
            effectIndex={effectIndex}
            delta={effect.delta}
            options={options}
            isTwoSkills={isTwoSkills}
            currentChoice={currentChoice}
            onChange={(choice) => onChooserChange(effectIndex, choice)}
          />
        );
      })}

      {/* Remove button for repeatable single-instance (first purchase shown without label) */}
      {isRepeatable && totalInstances === 1 && (
        <div className="flex justify-end">
          <button
            onClick={onDeselect}
            className="text-xs px-2 py-0.5 rounded border border-charcoal-600 text-charcoal-400 hover:border-red-600 hover:text-red-400 transition-colors"
            aria-label={`Remove ${ability.name}`}
          >
            Remove
          </button>
        </div>
      )}

      {/* Tier cost summary */}
      {hasTiers && (
        <div className="text-xs text-charcoal-500">
          {ability.tiers![instance.tier - 1]?.label ?? ability.tiers![0]?.label} — {cumulativeCost(ability, instance.tier)} AP
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier selector sub-component
// ---------------------------------------------------------------------------

interface TierSelectorProps {
  ability: Ability;
  selectedTier: number;
  canAffordTier: (tierIndex: number) => boolean;
  onTierChange: (tier: number) => void;
  eligible: boolean;
}

function TierSelector({ ability, selectedTier, canAffordTier, onTierChange, eligible }: TierSelectorProps) {
  const tiers = ability.tiers!;

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-charcoal-500 font-semibold uppercase tracking-wide">Tier</div>
      <div className="flex flex-wrap gap-1">
        {tiers.map((tier, idx) => {
          const tierValue = idx + 1;
          const cost = cumulativeCost(ability, tierValue);
          const isCurrentTier = selectedTier === tierValue;
          const canAfford = canAffordTier(tierValue);
          const selectable = eligible && canAfford;

          return (
            <button
              key={idx}
              onClick={() => {
                if (!selectable && !isCurrentTier) return;
                onTierChange(tierValue);
              }}
              disabled={!selectable && !isCurrentTier}
              title={`${tier.label} — ${cost} AP cumulative`}
              className={`text-xs px-2 py-1 rounded border transition-colors
                ${isCurrentTier
                  ? 'border-orange-500 bg-orange-500/20 text-orange-300 font-bold'
                  : selectable
                    ? 'border-charcoal-600 text-charcoal-300 hover:border-orange-600 hover:text-orange-400'
                    : 'border-charcoal-800 text-charcoal-700 cursor-not-allowed'
                }`}
            >
              {toRomanNumeral(tierValue)}
              <span className="text-charcoal-500 ml-1 font-mono text-[10px]">{cost}ap</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chooser selector sub-component
// ---------------------------------------------------------------------------

interface ChooserSelectorProps {
  abilityId: string;
  effectIndex: number;
  delta: number;
  options: SkillStat[];
  isTwoSkills: boolean;
  currentChoice: SkillStat | SkillStat[] | undefined;
  onChange: (choice: SkillStat | SkillStat[]) => void;
}

function ChooserSelector({
  abilityId,
  effectIndex,
  delta,
  options,
  isTwoSkills,
  currentChoice,
  onChange,
}: ChooserSelectorProps) {
  const label = abilityId === 'aggressive-spiker' && effectIndex === 1
    ? `−0.25 from (Stamina or IQ)`
    : isTwoSkills
      ? `Choose two stats (in-game effect)`
      : delta >= 0
        ? `+${delta} to`
        : `${delta} to`;

  if (isTwoSkills) {
    const current = Array.isArray(currentChoice) ? (currentChoice as SkillStat[]) : [];
    return (
      <div className="flex flex-col gap-1.5 bg-charcoal-800/50 rounded-lg p-2">
        <div className="text-xs text-charcoal-400 font-semibold">{label}</div>
        <div className="flex flex-wrap gap-1">
          {options.map((stat) => {
            const isChosen = current.includes(stat);
            const maxReached = current.length >= 2 && !isChosen;
            return (
              <button
                key={stat}
                disabled={maxReached}
                onClick={() => {
                  if (isChosen) {
                    onChange(current.filter((s) => s !== stat));
                  } else if (!maxReached) {
                    onChange([...current, stat]);
                  }
                }}
                className={`text-xs px-2 py-0.5 rounded border transition-colors
                  ${isChosen
                    ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                    : maxReached
                      ? 'border-charcoal-700 text-charcoal-600 cursor-not-allowed'
                      : 'border-charcoal-600 text-charcoal-300 hover:border-orange-500 hover:text-orange-400'
                  }`}
              >
                {stat}
              </button>
            );
          })}
        </div>
        {current.length > 0 && (
          <div className="text-xs text-charcoal-500">
            Selected: {current.join(', ')} ({current.length}/2)
          </div>
        )}
      </div>
    );
  }

  // Single-select
  const current = Array.isArray(currentChoice) ? undefined : currentChoice as SkillStat | undefined;
  return (
    <div className="flex flex-col gap-1.5 bg-charcoal-800/50 rounded-lg p-2">
      <div className="text-xs text-charcoal-400 font-semibold">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((stat) => {
          const isChosen = current === stat;
          return (
            <button
              key={stat}
              onClick={() => onChange(stat)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors
                ${isChosen
                  ? 'border-orange-500 bg-orange-500/20 text-orange-300 font-bold'
                  : 'border-charcoal-600 text-charcoal-300 hover:border-orange-500 hover:text-orange-400'
                }`}
            >
              {stat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

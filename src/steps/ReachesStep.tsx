// ReachesStep -- auto-computed reaches from Height/Vertical + three distribution charts

import { useMemo } from 'react';
import { useCharacter } from '../state/characterStore';
import { DistributionChart } from '../charts/DistributionChart';
import {
  standingReachPmf,
  spikingReachPmf,
  blockingReachPmf,
  percentileOf,
  binPmfToIntegers,
  type PmfPoint,
} from '../charts/distributions';

// Compute reach PMFs once (they are independent of character state)
const standPmf = standingReachPmf();
const spikePmf = spikingReachPmf();
const blockPmf085 = blockingReachPmf(0.85);

interface ReachRowProps {
  label: string;
  formula: string;
  valueCm: number | null;
  pmf: PmfPoint[];
}

function ReachRow({ label, formula, valueCm, pmf }: ReachRowProps) {
  // Percentile from the raw (exact) PMF; chart from a whole-cm binned PMF so the
  // curve is smooth rather than spiky.
  const pct = valueCm !== null ? percentileOf(valueCm, pmf) : null;
  const chartPmf = useMemo(() => binPmfToIntegers(pmf), [pmf]);

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <span className="text-base font-bold text-charcoal-100">{label}</span>
          <span className="text-xs text-charcoal-500 ml-2 font-mono">{formula}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-black text-orange-400">
            {valueCm !== null ? valueCm.toFixed(1) + ' cm' : '--'}
          </span>
          {pct !== null && (
            <span className="text-xs font-semibold text-orange-300">
              {pct}th percentile
            </span>
          )}
        </div>
      </div>
      <DistributionChart
        pmf={chartPmf}
        markerValue={valueCm !== null ? Math.round(valueCm * 100) / 100 : null}
        unit=" cm"
      />
    </div>
  );
}

export function ReachesStep() {
  const { derivedReaches, character } = useCharacter();

  const physical = character.physical;

  const standing = derivedReaches?.standingReachCm ?? null;
  const spiking  = derivedReaches?.spikingReachCm  ?? null;
  const blocking = derivedReaches?.blockingReachCm ?? null;
  const blockCoef = derivedReaches?.blockingCoef ?? 0.85;

  const effectiveBlockPmf = useMemo(() => {
    if (blockCoef !== 0.85) return blockingReachPmf(blockCoef);
    return blockPmf085;
  }, [blockCoef]);

  if (!physical) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-orange-400">Derived Reaches</h2>
        <div className="card text-charcoal-400 italic">
          Complete the <strong className="text-charcoal-300">Physical Attributes</strong> step first --
          assign both Height and Vertical Jump to see your reach calculations.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-orange-400 mb-1">Derived Reaches</h2>
        <p className="text-charcoal-400 text-sm">
          All three reaches are computed automatically from your{' '}
          <strong className="text-charcoal-200">Height ({physical.heightCm} cm)</strong> and{' '}
          <strong className="text-charcoal-200">Vertical Jump ({physical.verticalCm} cm)</strong>.
          The charts show the population distribution across all possible 3d10 roll combinations.
        </p>
      </div>

      {/* Quick summary row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Standing', value: standing },
          { label: 'Spiking',  value: spiking  },
          { label: 'Blocking', value: blocking  },
        ].map(({ label, value }) => (
          <div key={label} className="card py-3">
            <div className="text-xs text-charcoal-500 uppercase tracking-wide mb-1">{label}</div>
            <div className="text-xl font-black text-orange-400">
              {value !== null ? value.toFixed(1) + ' cm' : '--'}
            </div>
          </div>
        ))}
      </div>

      <ReachRow
        label="Standing Reach"
        formula="1.3 x Height"
        valueCm={standing}
        pmf={standPmf}
      />
      <ReachRow
        label="Spiking Reach"
        formula="1.3 x Height + Vertical"
        valueCm={spiking}
        pmf={spikePmf}
      />
      <ReachRow
        label={blockCoef !== 0.85 ? 'Blocking Reach (Swing Block)' : 'Blocking Reach'}
        formula={'1.3 x Height + ' + blockCoef + ' x Vertical'}
        valueCm={blocking}
        pmf={effectiveBlockPmf}
      />

      {blockCoef !== 0.85 && (
        <p className="text-xs text-orange-300 text-center">
          Swing Block ability active -- blocking coefficient raised from 0.85 to {blockCoef}.
          The blocking chart uses the modified population distribution.
        </p>
      )}
    </div>
  );
}

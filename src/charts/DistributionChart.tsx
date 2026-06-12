// ─────────────────────────────────────────────────────────────────────────────
// DistributionChart — hand-rolled SVG area/bar chart with marker + percentile
//
// Props:
//   pmf           — array of {value, prob} sorted ascending (from distributions.ts)
//   markerValue   — the character's current value (draws a vertical line)
//   label         — chart title (e.g. "Height Distribution")
//   unit          — suffix for value labels (e.g. "cm" or "")
//   markerLabel   — optional override for marker tooltip text
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import type { PmfPoint } from './distributions';
import { percentileOf } from './distributions';

interface DistributionChartProps {
  pmf: PmfPoint[];
  markerValue?: number | null;
  label?: string;
  unit?: string;
  markerLabel?: string;
  /** Width of each bar in SVG units. Defaults to auto (fill space). */
  barWidthOverride?: number;
}

const CHART_WIDTH  = 560;
const CHART_HEIGHT = 160;
const PAD_LEFT     = 40;
const PAD_RIGHT    = 16;
const PAD_TOP      = 16;
const PAD_BOTTOM   = 28;

const PLOT_W = CHART_WIDTH  - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_HEIGHT - PAD_TOP  - PAD_BOTTOM;

export function DistributionChart({
  pmf,
  markerValue,
  label,
  unit = '',
  markerLabel,
}: DistributionChartProps) {
  const data = useMemo(() => {
    if (!pmf || pmf.length === 0) return null;

    const values = pmf.map((p) => p.value);
    const probs  = pmf.map((p) => p.prob);
    const minVal = values[0];
    const maxVal = values[values.length - 1];
    const maxProb = Math.max(...probs);

    const valueRange = maxVal - minVal || 1;

    // x position (0..PLOT_W) for a given value
    const xOf = (v: number) => ((v - minVal) / valueRange) * PLOT_W;

    // y position (0..PLOT_H, inverted — 0 is top) for a given probability
    const yOf = (p: number) => PLOT_H - (p / maxProb) * PLOT_H;

    // Bar width fills the (median) spacing between values so bars tile edge-to-edge
    // for a clean solid histogram.
    let barW = 8;
    if (pmf.length > 1) {
      const gaps = pmf.slice(1).map((p, i) => p.value - pmf[i].value).sort((a, b) => a - b);
      const medianGap = gaps[Math.floor(gaps.length / 2)] || (valueRange / pmf.length);
      barW = Math.max(1, (medianGap / valueRange) * PLOT_W);
    }

    // Marker
    let markerX: number | null = null;
    let markerPct: number | null = null;
    if (markerValue != null) {
      markerX  = xOf(markerValue);
      markerPct = percentileOf(markerValue, pmf);
    }

    // X-axis tick labels — pick ~5 evenly spaced
    const tickCount = Math.min(5, pmf.length);
    const step = Math.floor(pmf.length / (tickCount - 1 || 1));
    const ticks: { x: number; label: string }[] = [];
    for (let i = 0; i < pmf.length; i += step) {
      ticks.push({ x: xOf(pmf[i].value), label: String(pmf[i].value) });
    }
    // Always include last
    const last = pmf[pmf.length - 1];
    if (ticks[ticks.length - 1].label !== String(last.value)) {
      ticks.push({ x: xOf(last.value), label: String(last.value) });
    }

    // Y-axis: max probability label
    const maxProbPct = (maxProb * 100).toFixed(1) + '%';

    return {
      pmf, values, probs, minVal, maxVal, maxProb, valueRange,
      xOf, yOf, barW,
      markerX, markerPct, ticks, maxProbPct,
    };
  }, [pmf, markerValue]);

  if (!data) {
    return (
      <div className="card text-charcoal-500 italic text-sm p-4">
        {label ?? 'Distribution'}: no data yet
      </div>
    );
  }

  const {
    pmf: pts, xOf, yOf, barW,
    markerX, markerPct, ticks, maxProbPct,
  } = data;

  const displayMarker = markerValue != null && markerX != null;
  const displayPct    = displayMarker && markerPct != null;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-charcoal-300">{label}</span>
          {displayPct && (
            <span className="text-xs font-bold text-orange-400">
              {markerLabel ? `${markerLabel} · ` : ''}
              {markerValue}{unit} — {markerPct}th percentile
            </span>
          )}
        </div>
      )}
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full rounded-lg overflow-visible"
        role="img"
        aria-label={`${label ?? 'Distribution chart'}${displayMarker ? `, marker at ${markerValue}${unit} (${markerPct}th percentile)` : ''}`}
      >
        {/* Gradient definition */}
        <defs>
          {displayMarker && (
            <linearGradient id="marker-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#fb923c" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fb923c" stopOpacity="0.3" />
            </linearGradient>
          )}
        </defs>

        {/* Plot area background */}
        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={PLOT_W}
          height={PLOT_H}
          fill="rgba(31,31,31,0.7)"
          rx="4"
        />

        {/* Grid lines (3 horizontal) */}
        {[0.25, 0.5, 0.75, 1.0].map((frac) => (
          <line
            key={frac}
            x1={PAD_LEFT}
            y1={PAD_TOP + PLOT_H * (1 - frac)}
            x2={PAD_LEFT + PLOT_W}
            y2={PAD_TOP + PLOT_H * (1 - frac)}
            stroke="rgba(67,67,67,0.5)"
            strokeWidth="0.5"
          />
        ))}

        {/* Bar ticks for individual values */}
        {pts.map((p, i) => {
          const x = xOf(p.value);
          const y = yOf(p.prob);
          return (
            <rect
              key={i}
              x={PAD_LEFT + x - barW / 2}
              y={PAD_TOP + y}
              width={Math.max(1, barW - 0.5)}
              height={PLOT_H - y}
              fill="#E8741E"
              fillOpacity={1}
            />
          );
        })}

        {/* Marker line */}
        {displayMarker && markerX != null && (
          <>
            <line
              x1={PAD_LEFT + markerX}
              y1={PAD_TOP}
              x2={PAD_LEFT + markerX}
              y2={PAD_TOP + PLOT_H}
              stroke="#fb923c"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            {/* Diamond marker at top */}
            <polygon
              points={`
                ${PAD_LEFT + markerX},${PAD_TOP - 2}
                ${PAD_LEFT + markerX - 5},${PAD_TOP + 7}
                ${PAD_LEFT + markerX},${PAD_TOP + 14}
                ${PAD_LEFT + markerX + 5},${PAD_TOP + 7}
              `}
              fill="#fb923c"
            />
          </>
        )}

        {/* X-axis line */}
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP + PLOT_H}
          x2={PAD_LEFT + PLOT_W}
          y2={PAD_TOP + PLOT_H}
          stroke="#515151"
          strokeWidth="1"
        />

        {/* Y-axis line */}
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={PAD_TOP + PLOT_H}
          stroke="#515151"
          strokeWidth="1"
        />

        {/* X-axis tick labels */}
        {ticks.map((t, i) => (
          <text
            key={i}
            x={PAD_LEFT + t.x}
            y={PAD_TOP + PLOT_H + 14}
            fontSize="9"
            textAnchor="middle"
            fill="#818181"
          >
            {t.label}{unit}
          </text>
        ))}

        {/* Y-axis max label */}
        <text
          x={PAD_LEFT - 4}
          y={PAD_TOP + 4}
          fontSize="9"
          textAnchor="end"
          fill="#818181"
        >
          {maxProbPct}
        </text>
        <text
          x={PAD_LEFT - 4}
          y={PAD_TOP + PLOT_H}
          fontSize="9"
          textAnchor="end"
          fill="#818181"
        >
          0%
        </text>
      </svg>
    </div>
  );
}

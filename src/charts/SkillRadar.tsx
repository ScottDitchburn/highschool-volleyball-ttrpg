// ─────────────────────────────────────────────────────────────────────────────
// SkillRadar — hand-rolled SVG radar/spider chart for the ten skill stats.
// Scale runs 0..maxScale (>=4; expands if ability bonuses push a stat above 4).
// ─────────────────────────────────────────────────────────────────────────────

import { SKILL_STAT_NAMES, type SkillStats } from '../types';

interface Props {
  stats: SkillStats;
  /** Light-background colour scheme for the Print/PDF sheet. */
  print?: boolean;
}

const W = 360;
const H = 320;
const CX = W / 2;
const CY = H / 2;
const R = 108; // radius at full scale

export function SkillRadar({ stats, print = false }: Props) {
  const gridColor  = print ? '#cfcfcf' : 'rgba(67,67,67,0.55)';
  const scaleColor = print ? '#9a9a9a' : '#6b6b6b';
  const nameColor  = print ? '#333333' : '#bdbdbd';
  const labels = SKILL_STAT_NAMES;
  const n = labels.length;

  const maxStat = Math.max(4, ...labels.map((l) => stats[l] ?? 0));
  const maxScale = Math.ceil(maxStat); // integer rings (4, or higher with bonuses)

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, value: number): [number, number] => {
    const r = (value / maxScale) * R;
    const a = angleFor(i);
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };

  const ringLevels = Array.from({ length: maxScale }, (_, k) => k + 1);

  const polyPoints = (value: number) =>
    labels.map((_, i) => pointAt(i, value).map((v) => v.toFixed(1)).join(',')).join(' ');

  const dataPts = labels.map((l, i) => pointAt(i, stats[l] ?? 0));
  const dataPoly = dataPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[360px] mx-auto"
      role="img"
      aria-label={`Skill stats radar: ${labels.map((l) => `${l} ${(stats[l] ?? 0).toFixed(2)}`).join(', ')}`}
    >
      {/* Concentric ring polygons */}
      {ringLevels.map((lvl) => (
        <polygon
          key={lvl}
          points={polyPoints(lvl)}
          fill="none"
          stroke={gridColor}
          strokeWidth="0.75"
        />
      ))}

      {/* Axis spokes */}
      {labels.map((_, i) => {
        const [x, y] = pointAt(i, maxScale);
        return (
          <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke={gridColor} strokeWidth="0.75" />
        );
      })}

      {/* Ring scale numbers along the top spoke */}
      {ringLevels.map((lvl) => {
        const [, y] = pointAt(0, lvl);
        return (
          <text key={`s${lvl}`} x={CX + 3} y={y + 3} fontSize="8" fill={scaleColor}>
            {lvl}
          </text>
        );
      })}

      {/* Data polygon */}
      <polygon points={dataPoly} fill="#E8741E" fillOpacity="0.28" stroke="#E8741E" strokeWidth="2" strokeLinejoin="round" />

      {/* Data vertices */}
      {dataPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#fb923c" />
      ))}

      {/* Axis labels (name + value) */}
      {labels.map((l, i) => {
        const a = angleFor(i);
        const lx = CX + (R + 22) * Math.cos(a);
        const ly = CY + (R + 22) * Math.sin(a);
        const cos = Math.cos(a);
        const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
        return (
          <g key={`lab${i}`}>
            <text x={lx} y={ly} fontSize="10" fontWeight="700" textAnchor={anchor} fill={nameColor}>
              {l}
            </text>
            <text x={lx} y={ly + 11} fontSize="9" textAnchor={anchor} fill="#E8741E" fontWeight="800">
              {(stats[l] ?? 0).toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

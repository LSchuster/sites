import { useAtlas, setState } from '../state/store.ts';
import { maxValue, useConflictsLoaded } from '../data/conflicts.ts';
import { useT } from '../i18n/index.ts';
import { formatDeaths } from '../i18n/format.ts';
import { LEGEND_STOPS, magnitudeColor, radius } from './scales.ts';
import type { VizMode } from '../types.ts';

/** Minimum vertical distance between two legend labels before they read as one. */
const LABEL_GAP = 12;

/**
 * Place the tick labels so they never collide.
 *
 * The circles are nested, so at the small end their tops are only a few pixels
 * apart — 10k and 100k differ by 6px of radius. Anchoring each label to its own
 * circle would overlap them into mush. Instead labels are pushed apart to a
 * minimum spacing and a leader line angles out to each one.
 */
function labelLayout(
  stops: readonly number[],
  max: number,
  baseline: number,
): { stop: number; r: number; top: number; labelY: number }[] {
  const rows = [...stops]
    .sort((a, b) => b - a)
    .map((stop) => {
      const r = radius({ value: stop, max });
      return { stop, r, top: baseline - r * 2, labelY: baseline - r * 2 };
    });

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const row = rows[i];
    if (!prev || !row) continue;
    row.labelY = Math.max(row.labelY, prev.labelY + LABEL_GAP);
  }
  return rows;
}

/**
 * The legend exists because the radius scale is deliberately compressed. Without
 * calibration circles a reader would reasonably assume area-proportional sizing
 * and badly misjudge every ratio on the map. Showing the actual sizes for known
 * values is the honest fix.
 */
export function Legend(): React.JSX.Element {
  const vizMode = useAtlas((s) => s.vizMode);
  const t = useT();
  // Without this the legend renders against an empty dataset (max = 1) and every
  // calibration circle comes out at the maximum radius.
  useConflictsLoaded();
  const max = maxValue('absolute');
  const biggest = LEGEND_STOPS[LEGEND_STOPS.length - 1] ?? 1;
  const maxR = radius({ value: biggest, max });

  const PAD = 6;
  const cx = PAD + maxR;
  const baseline = PAD + maxR * 2;
  const boxW = 212;
  const boxH = baseline + 8;

  return (
    <div className="legend">
      <div className="legend__modes" role="group" aria-label={t.legend.measure}>
        {(
          [
            ['absolute', t.legend.deaths],
            ['population', t.legend.shareOfWorld],
          ] as [VizMode, string][]
        ).map(([mode, label]) => (
          <button
            key={mode}
            className={`legend__mode${vizMode === mode ? ' is-active' : ''}`}
            onClick={() => setState({ vizMode: mode })}
            aria-pressed={vizMode === mode}
          >
            {label}
          </button>
        ))}
      </div>

      <svg
        className="legend__svg"
        viewBox={`0 0 ${boxW} ${boxH}`}
        width={boxW}
        height={boxH}
        role="img"
        aria-label={t.legend.sizeScale}
      >
        {labelLayout(LEGEND_STOPS, max, baseline).map(({ stop, r, top, labelY }) => (
          <g key={stop}>
            <circle
              cx={cx}
              cy={baseline - r}
              r={r}
              fill="none"
              stroke={magnitudeColor({ value: stop, max })}
              strokeOpacity={0.75}
              strokeWidth={1}
            />
            <line
              x1={cx}
              y1={top}
              x2={cx + maxR + 8}
              y2={labelY}
              stroke="currentColor"
              strokeOpacity={0.22}
              strokeDasharray="2 2"
            />
            <text className="legend__tick" x={cx + maxR + 12} y={labelY}>
              {formatDeaths(stop, t)}
            </text>
          </g>
        ))}
      </svg>

      <p className="legend__note">
        {t.legend.note}
        {vizMode === 'population' && ` ${t.legend.populationNote}`}
      </p>
    </div>
  );
}

import type { Conflict } from '../types.ts';
import { YEAR_MAX, YEAR_MIN } from '../state/store.ts';

/**
 * Deaths attributable to each year, for the strip behind the scrubber.
 *
 * Each conflict's total is spread evenly across its duration. That is crude —
 * the Thirty Years' War did not kill at a constant rate — but the alternative
 * (attributing a 160-year war's entire toll to its start year) produces spikes
 * that are actively wrong. Conflicts marked `partOf` are skipped: their deaths
 * are already inside a parent's total and counting both would double them.
 */
export function deathsPerYear(conflicts: Conflict[]): Float64Array {
  const series = new Float64Array(YEAR_MAX - YEAR_MIN + 1);
  for (const c of conflicts) {
    if (c.partOf) continue;
    const from = Math.max(YEAR_MIN, c.startYear);
    const to = Math.min(YEAR_MAX, c.endYear);
    if (to < from) continue;
    const years = to - from + 1;
    const perYear = c.total.best / years;
    for (let y = from; y <= to; y++) {
      const i = y - YEAR_MIN;
      series[i] = (series[i] ?? 0) + perYear;
    }
  }
  return series;
}

/**
 * Build an SVG area path.
 *
 * The y-axis is square-root scaled, and the label under the timeline says so.
 * Linear would render eighteen centuries as a flat line against the 20th century;
 * log would exaggerate the small values and is genuinely misleading for an area
 * mark. Square root keeps the ordering honest and the shape readable. This strip
 * is a navigation aid — exact magnitudes come from the panel.
 */
export function areaPath(series: Float64Array, width: number, height: number): string {
  let max = 0;
  for (const v of series) if (v > max) max = v;
  if (max <= 0) return '';

  const n = series.length;
  const scaleY = (v: number) => height - Math.sqrt(v / max) * height;

  // One point per pixel column, taking the max within each column so single-year
  // spikes survive downsampling to ~1400px.
  const cols = Math.max(2, Math.round(width));
  const parts: string[] = [];
  for (let i = 0; i < cols; i++) {
    const lo = Math.floor((i / cols) * n);
    const hi = Math.max(lo + 1, Math.floor(((i + 1) / cols) * n));
    let peak = 0;
    for (let j = lo; j < hi && j < n; j++) {
      const v = series[j];
      if (v !== undefined && v > peak) peak = v;
    }
    const x = (i / (cols - 1)) * width;
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${scaleY(peak).toFixed(1)}`);
  }
  parts.push(`L${width},${height}`, `L0,${height}`, 'Z');
  return parts.join('');
}

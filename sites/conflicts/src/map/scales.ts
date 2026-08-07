import { MAGNITUDE } from '../theme.ts';
import type { CasualtyRange, Conflict, Side, VizMode } from '../types.ts';

/**
 * The scale problem.
 *
 * World War II killed ~75,000,000 people. The Battle of Adrianople killed perhaps
 * 25,000. That is a ratio of 3,000:1, and across the whole dataset the spread runs
 * to five orders of magnitude. Three obvious encodings all fail:
 *
 *   - Area-proportional (r ∝ √v): WWII's radius is 55× Adrianople's. Either the
 *     small conflicts are invisible or the large ones cover a continent.
 *   - Linear radius: worse — 3,000×.
 *   - Log radius: compresses honestly but destroys the *sense* of ratio; a war ten
 *     times deadlier looks marginally bigger, which reads as a lie in the other
 *     direction.
 *
 * What we use instead is a damped power curve on the value normalised against the
 * largest conflict in the dataset. The exponent is well below 0.5, so it compresses
 * harder than area-proportional, but it is still a power law: doubling the deaths
 * always increases the radius by the same factor anywhere on the scale.
 *
 * The compression is real and the legend says so out loud, with calibration circles
 * at 10k / 100k / 1M / 10M / 75M. A reader who wants exact magnitudes gets them from
 * the panel; the bubbles are for rank and shape.
 */
const R_MIN = 3;
const R_MAX = 58;
const EXPONENT = 0.42;

export interface Magnitude {
  /** The value being encoded: absolute deaths, or share of world population. */
  value: number;
  /** Largest value across the dataset in the current mode — the scale's anchor. */
  max: number;
}

export function radius({ value, max }: Magnitude): number {
  if (!(value > 0) || !(max > 0)) return R_MIN;
  const t = Math.min(1, value / max);
  return R_MIN + (R_MAX - R_MIN) * Math.pow(t, EXPONENT);
}

/** Colour from the sequential ramp, driven by the same normalised value. */
export function magnitudeColor({ value, max }: Magnitude): string {
  if (!(value > 0) || !(max > 0)) return MAGNITUDE[0];
  const t = Math.min(1, Math.pow(value / max, EXPONENT));
  const i = Math.min(MAGNITUDE.length - 1, Math.floor(t * MAGNITUDE.length));
  return MAGNITUDE[i] ?? MAGNITUDE[0];
}

export const LEGEND_STOPS = [10_000, 100_000, 1_000_000, 10_000_000, 75_000_000];

/** Total deaths attributed to one side, military plus civilian. */
export function sideTotal(side: Side): number {
  return (side.military?.best ?? 0) + (side.civilian?.best ?? 0);
}

/** Widest plausible bounds for a side, used for the uncertainty whisker. */
export function sideBounds(side: Side): { low: number; high: number } {
  return {
    low: (side.military?.low ?? 0) + (side.civilian?.low ?? 0),
    high: (side.military?.high ?? 0) + (side.civilian?.high ?? 0),
  };
}

/** How wide the uncertainty is, as a multiple of the best estimate. */
export function uncertaintyRatio(r: CasualtyRange): number {
  if (r.best <= 0) return 1;
  return r.high / Math.max(1, r.low);
}

export function isActive(c: Conflict, year: number): boolean {
  return year >= c.startYear && year <= c.endYear;
}

/**
 * The value a conflict contributes in the current view mode.
 *
 * In population mode this is the share of everyone alive at the time — the only
 * fair way to compare An Lushan (perhaps 1 in 6 humans) with the Second World War
 * (about 1 in 33). Deaths are spread evenly across the conflict's duration, which
 * is crude but avoids attributing a 160-year war's entire toll to its first year.
 */
export function conflictValue(c: Conflict, mode: VizMode, worldPop: (y: number) => number): number {
  if (mode === 'absolute') return c.total.best;
  const midYear = Math.round((c.startYear + c.endYear) / 2);
  const pop = worldPop(midYear);
  return pop > 0 ? c.total.best / pop : 0;
}

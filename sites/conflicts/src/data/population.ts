/**
 * World population by year, for the population-share view.
 *
 * Anchor points from the standard historical demography estimates — the pre-1950
 * baseline follows McEvedy & Jones (HYDE runs higher in antiquity; we picked one
 * series rather than average incompatible ones), UN figures from 1950. Pre-modern
 * values are themselves estimates with wide error bars — the year 0 figure is
 * quoted anywhere between 170 and 400 million — so this supports comparisons of
 * order ("one in six" vs "one in thirty"), not precision.
 *
 * The first-millennium anchors carry the two great pandemic dips: the Antonine
 * Plague (165–180) and the first wave of the Plague of Justinian (541–544).
 * Their magnitudes are contested — recent scholarship argues the Justinianic dip
 * was smaller than the older "25–50 million" claims — so both are drawn modest.
 * Anchors from 700 on are load-bearing: the About page's An Lushan "one in six"
 * rests on worldPopulation(759) ≈ 216M staying put.
 *
 * Kept as a table rather than a fetched file: it is 40 numbers, it never changes,
 * and inlining it removes a network round-trip from the critical path.
 */
const ANCHORS: [year: number, millions: number][] = [
  [0, 190],
  [160, 193],
  [180, 184], // Antonine Plague
  [220, 190],
  [270, 186], // Plague of Cyprian
  [350, 190],
  [500, 192],
  [541, 194],
  [545, 181], // Plague of Justinian, first wave
  [600, 194],
  [700, 210],
  [800, 220],
  [900, 240],
  [1000, 275],
  [1100, 320],
  [1200, 360],
  [1300, 360],
  [1400, 350], // the Black Death is the only sustained fall in the record
  [1500, 460],
  [1600, 580],
  [1700, 680],
  [1750, 790],
  [1800, 980],
  [1850, 1260],
  [1900, 1650],
  [1950, 2536],
  [1960, 3034],
  [1970, 3700],
  [1980, 4458],
  [1990, 5327],
  [2000, 6143],
  [2010, 6957],
  [2020, 7841],
  [2026, 8200],
];

/** Linearly interpolated world population for a given year. */
export function worldPopulation(year: number): number {
  const first = ANCHORS[0];
  const last = ANCHORS[ANCHORS.length - 1];
  if (!first || !last) return 0;
  if (year <= first[0]) return first[1] * 1e6;
  if (year >= last[0]) return last[1] * 1e6;

  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const a = ANCHORS[i];
    const b = ANCHORS[i + 1];
    if (!a || !b) continue;
    if (year >= a[0] && year <= b[0]) {
      const t = (year - a[0]) / (b[0] - a[0]);
      return (a[1] + (b[1] - a[1]) * t) * 1e6;
    }
  }
  return last[1] * 1e6;
}

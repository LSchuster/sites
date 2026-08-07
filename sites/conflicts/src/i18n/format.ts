import type { Messages } from './types.ts';

/**
 * Locale-aware number formatting.
 *
 * English writes "75M" and "620k"; German writes "75 Mio." and "620 Tsd." with a
 * comma for the decimal separator. Both the suffix and the separator come from the
 * active dictionary and `Intl`, so neither is baked into the call sites.
 */
export function formatDeaths(n: number, t: Messages): string {
  const nf = (value: number, digits: number) =>
    new Intl.NumberFormat(t.bcp47, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);

  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${nf(m, m >= 10 ? 0 : 1)}${t.units.million}`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${nf(k, k >= 10 ? 0 : 1)}${t.units.thousand}`;
  }
  return new Intl.NumberFormat(t.bcp47).format(n);
}

export function formatCount(n: number, t: Messages): string {
  return new Intl.NumberFormat(t.bcp47).format(n);
}

/** A share of the population, as a percentage or a "1 in N" ratio when tiny. */
export function formatShare(share: number, t: Messages): string {
  if (!(share > 0)) return '—';
  const pct = (digits: number) =>
    new Intl.NumberFormat(t.bcp47, {
      style: 'percent',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(share);
  if (share >= 0.01) return pct(1);
  if (share >= 0.001) return pct(2);
  return `1 : ${new Intl.NumberFormat(t.bcp47).format(Math.round(1 / share))}`;
}

/** Inclusive year span, e.g. "1939 – 1945" or a single year. */
export function formatYears(start: number, end: number, t: Messages): string {
  const f = (y: number) => new Intl.NumberFormat(t.bcp47, { useGrouping: false }).format(y);
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
}

import type { Invoice, LineItem, VatRate } from './invoice';
import { effectiveRate, VAT_CATEGORY } from './taxcases';

/**
 * All money math lives here, in integer cents, and feeds BOTH the PDF layout
 * and the CII XML. Rounding follows EN 16931: line totals are rounded to
 * cents per line (BT-131), VAT is computed per rate group on the summed basis
 * at document level (BR-CO-17), and document totals are sums of already-
 * rounded cents so BR-CO-10…15 hold by construction.
 */

export interface RateGroup {
  rate: VatRate;
  category: 'S' | 'E' | 'AE' | 'K' | 'G';
  basisCents: number;
  vatCents: number;
}

export interface Totals {
  /** Rounded net amount per line id, in cents. */
  lineNetCents: Map<string, number>;
  /** VAT breakdown, one entry per distinct rate, ordered high → low. */
  byRate: RateGroup[];
  netCents: number;
  vatCents: number;
  grossCents: number;
}

/** Round a non-negative integer numerator divided by 10^n, half up, exactly. */
function divRoundHalfUp(numerator: number, divisor: number): number {
  const q = Math.floor(numerator / divisor);
  return numerator - q * divisor >= divisor / 2 ? q + 1 : q;
}

/** Line net in cents: quantityMilli (×10³) · unitPriceE4 (×10⁴) → € ×10². */
export function lineNetCents(line: LineItem): number {
  return divRoundHalfUp(line.quantityMilli * line.unitPriceE4, 100_000);
}

export function computeTotals(invoice: Invoice): Totals {
  const category = VAT_CATEGORY[invoice.taxCase];
  const lineNet = new Map<string, number>();
  const basisByRate = new Map<VatRate, number>();

  for (const line of invoice.lines) {
    // Text-only positions carry no amount — a priced position covers them.
    const net = line.textOnly ? 0 : lineNetCents(line);
    lineNet.set(line.id, net);
    if (line.textOnly) continue;
    const rate = effectiveRate(invoice.taxCase, line.vatRate);
    basisByRate.set(rate, (basisByRate.get(rate) ?? 0) + net);
  }

  const byRate: RateGroup[] = [...basisByRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, basisCents]) => ({
      rate,
      category,
      basisCents,
      vatCents: divRoundHalfUp(basisCents * rate, 100),
    }));

  const netCents = byRate.reduce((s, g) => s + g.basisCents, 0);
  const vatCents = byRate.reduce((s, g) => s + g.vatCents, 0);

  return {
    lineNetCents: lineNet,
    byRate,
    netCents,
    vatCents,
    grossCents: netCents + vatCents,
  };
}

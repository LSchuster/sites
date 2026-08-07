import type { TaxCase, VatRate } from './invoice';

/** EN 16931 / UNCL 5305 VAT category code for each supported tax case. */
export const VAT_CATEGORY: Record<TaxCase, 'S' | 'E' | 'AE' | 'K' | 'G'> = {
  standard: 'S',
  kleinunternehmer: 'E',
  reverse_charge: 'AE',
  innergem: 'K',
  export_third: 'G',
};

/** Whether a tax case charges VAT at all. Everything except S is zero-rated. */
export function isZeroRated(taxCase: TaxCase): boolean {
  return taxCase !== 'standard';
}

/** The VAT rate that actually applies to a line under the given tax case. */
export function effectiveRate(taxCase: TaxCase, lineRate: VatRate): VatRate {
  return isZeroRated(taxCase) ? 0 : lineRate;
}

/** Tax cases whose EN 16931 VAT breakdown requires an exemption reason (BR-E/AE/K/G-10). */
export function needsExemptionReason(taxCase: TaxCase): boolean {
  return taxCase !== 'standard';
}

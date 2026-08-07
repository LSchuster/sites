/**
 * Monetization switches. Links stay OFF until the affiliate programs are
 * approved and the Impressum is live (hard rule: no money link without
 * Impressum). Flipping a flag is the only change needed to ship them.
 */
/**
 * Spec versions displayed in the format picker. Bump when the standards
 * move (and re-run `npm run validate:einvoice` with a current Mustang CLI).
 */
export const FORMAT_VERSIONS = {
  zugferd: 'ZUGFeRD 2.5 / Factur-X 1.09 · Profil EN 16931',
  xrechnung: 'XRechnung 3.0.2 (EN 16931)',
};

export const MONETIZATION = {
  affiliatesEnabled: false,
  affiliates: [
    // Filled after Awin/financeAds approval, e.g.:
    // { name: 'sevDesk', url: 'https://…', blurb: 'Buchhaltung mit Belegerkennung' },
  ] as Array<{ name: string; url: string; blurb: string }>,

  donationEnabled: false,
  donationUrl: '', // e.g. https://ko-fi.com/…
};

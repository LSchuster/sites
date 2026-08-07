/**
 * Monetization switches. Links stay OFF until the affiliate programs are
 * approved and the Impressum is live (hard rule: no money link without
 * Impressum). Flipping a flag is the only change needed to ship them.
 */
export const MONETIZATION = {
  affiliatesEnabled: false,
  affiliates: [
    // Filled after Awin/financeAds approval, e.g.:
    // { name: 'sevDesk', url: 'https://…', blurb: 'Buchhaltung mit Belegerkennung' },
  ] as Array<{ name: string; url: string; blurb: string }>,

  donationEnabled: false,
  donationUrl: '', // e.g. https://ko-fi.com/…
};

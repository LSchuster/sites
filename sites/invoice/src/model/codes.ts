/** UN/ECE Recommendation 20 unit codes offered in the form (BT-130). */
export const UNIT_CODES = [
  'H87', // piece / Stück
  'C62', // unit / Einheit (dimensionless)
  'HUR', // hour
  'DAY', // day
  'MON', // month
  'KGM', // kilogram
  'MTR', // metre
  'KMT', // kilometre
  'MTK', // square metre
  'LTR', // litre
] as const;

export type UnitCode = (typeof UNIT_CODES)[number];

/** ISO 3166-1 alpha-2 codes offered in the country selects (extend on demand). */
export const COUNTRY_CODES = [
  'DE', 'AT', 'CH', 'FR', 'IT', 'NL', 'BE', 'LU', 'DK', 'PL', 'CZ', 'ES', 'PT',
  'SE', 'FI', 'NO', 'IE', 'GB', 'US',
] as const;

/** EU member states (2026) — used to sanity-check the innergem. tax case. */
export const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE',
]);

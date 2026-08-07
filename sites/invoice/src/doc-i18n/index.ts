import type { DocLanguage } from '../model/invoice';
import { de } from './de';
import { en } from './en';
import type { DocMessages } from './types';

export type { DocMessages } from './types';

const catalogs: Record<DocLanguage, DocMessages> = { de, en };

export function docMessages(lang: DocLanguage): DocMessages {
  return catalogs[lang];
}

/** € amount from integer cents, formatted for the document language. */
export function formatCents(cents: number, lang: DocLanguage): string {
  const fmt = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
  });
  return fmt.format(cents / 100);
}

/** Unit net price from integer €×10⁴, with 2–4 decimals as needed. */
export function formatUnitPrice(unitPriceE4: number, lang: DocLanguage): string {
  const hasSubCent = unitPriceE4 % 100 !== 0;
  const fmt = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: hasSubCent ? 4 : 2,
  });
  return fmt.format(unitPriceE4 / 10_000);
}

/** Quantity from integer ×10³, trimmed to at most 3 decimals. */
export function formatQuantity(quantityMilli: number, lang: DocLanguage): string {
  const fmt = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-IE', {
    maximumFractionDigits: 3,
  });
  return fmt.format(quantityMilli / 1000);
}

/** ISO yyyy-mm-dd → document-language date (31.12.2026 / 31 Dec 2026). */
export function formatDate(iso: string, lang: DocLanguage): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: lang === 'de' ? '2-digit' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

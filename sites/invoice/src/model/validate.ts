import { EU_COUNTRIES } from './codes';
import type { Invoice } from './invoice';

/**
 * Form-level validation of the § 14 UStG Pflichtangaben plus the
 * preconditions of the selected tax case. Message keys resolve through the
 * UI i18n catalog (i18n/locales/*.ts, `validation.*`).
 */
export interface Issue {
  /** Dot-path of the offending field group, for anchoring in the form. */
  field: string;
  /** i18n message key under `validation.` */
  key: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function partyIssues(prefix: 'seller' | 'buyer', p: Invoice['seller'] | Invoice['buyer']): Issue[] {
  const issues: Issue[] = [];
  if (!p.name.trim()) issues.push({ field: `${prefix}.name`, key: `${prefix}Name` });
  if (!p.street.trim() || !p.postcode.trim() || !p.city.trim() || !p.countryCode)
    issues.push({ field: `${prefix}.address`, key: `${prefix}Address` });
  return issues;
}

export function validateInvoice(invoice: Invoice): Issue[] {
  const issues: Issue[] = [];

  issues.push(...partyIssues('seller', invoice.seller));
  issues.push(...partyIssues('buyer', invoice.buyer));

  // § 14 Abs. 4 Nr. 2: Steuernummer ODER USt-IdNr. of the seller.
  if (!invoice.seller.taxNumber?.trim() && !invoice.seller.vatId?.trim())
    issues.push({ field: 'seller.taxId', key: 'sellerTaxId' });

  if (!invoice.seller.iban.trim()) issues.push({ field: 'seller.iban', key: 'sellerIban' });

  if (!invoice.number.trim()) issues.push({ field: 'number', key: 'number' });
  if (!ISO_DATE.test(invoice.issueDate)) issues.push({ field: 'issueDate', key: 'issueDate' });

  // § 14 Abs. 4 Nr. 6: Zeitpunkt der Lieferung/Leistung — date or period.
  const hasDelivery = !!invoice.deliveryDate && ISO_DATE.test(invoice.deliveryDate);
  const hasPeriod =
    !!invoice.servicePeriod &&
    ISO_DATE.test(invoice.servicePeriod.from) &&
    ISO_DATE.test(invoice.servicePeriod.to) &&
    invoice.servicePeriod.from <= invoice.servicePeriod.to;
  if (!hasDelivery && !hasPeriod) issues.push({ field: 'deliveryDate', key: 'delivery' });

  if (invoice.lines.length === 0) issues.push({ field: 'lines', key: 'noLines' });
  invoice.lines.forEach((line, i) => {
    if (!line.description.trim())
      issues.push({ field: `lines.${i}.description`, key: 'lineDescription' });
    if (!(line.quantityMilli > 0)) issues.push({ field: `lines.${i}.quantity`, key: 'lineQuantity' });
    if (!(line.unitPriceE4 >= 0) || !Number.isFinite(line.unitPriceE4))
      issues.push({ field: `lines.${i}.unitPrice`, key: 'linePrice' });
  });

  if (!(invoice.paymentTermsDays >= 0)) issues.push({ field: 'paymentTermsDays', key: 'terms' });

  // Tax-case preconditions.
  switch (invoice.taxCase) {
    case 'innergem':
      if (!invoice.seller.vatId?.trim()) issues.push({ field: 'seller.vatId', key: 'innergemSellerVat' });
      if (!invoice.buyer.vatId?.trim()) issues.push({ field: 'buyer.vatId', key: 'innergemBuyerVat' });
      if (invoice.buyer.countryCode === 'DE' || !EU_COUNTRIES.has(invoice.buyer.countryCode))
        issues.push({ field: 'buyer.countryCode', key: 'innergemCountry' });
      break;
    case 'reverse_charge':
      if (!invoice.buyer.vatId?.trim()) issues.push({ field: 'buyer.vatId', key: 'reverseChargeBuyerVat' });
      break;
    case 'export_third':
      if (EU_COUNTRIES.has(invoice.buyer.countryCode))
        issues.push({ field: 'buyer.countryCode', key: 'exportCountry' });
      break;
    case 'standard':
    case 'kleinunternehmer':
      break;
  }

  return issues;
}

import type { UnitCode } from '../model/codes';
import type { TaxCase } from '../model/invoice';

/**
 * Everything printed ON the generated invoice document (PDF and preview) and
 * used as exemption-reason text in the CII XML. Chosen per invoice via
 * `docLanguage`, independent of the (German) UI language.
 *
 * The `taxNote` texts are fixed, vetted legal wordings — never reword or
 * generate them (see CLAUDE.md hard rule 3).
 */
export interface DocMessages {
  invoiceTitle: string;
  invoiceNo: string;
  issueDate: string;
  deliveryDate: string;
  servicePeriod: string;
  buyerReference: string;
  page: (n: number, of: number) => string;

  colPos: string;
  colDescription: string;
  colQty: string;
  colUnit: string;
  colUnitPrice: string;
  colVat: string;
  colNet: string;

  sumNet: string;
  sumVat: (ratePercent: number) => string;
  sumGross: string;

  paymentHeading: string;
  paymentTerms: (days: number, dueDateFormatted: string) => string;
  paymentTermsImmediate: string;
  bank: string;
  iban: string;
  bic: string;

  sellerTaxNumber: string;
  sellerVatId: string;
  phone: string;
  email: string;

  /** Fixed note per zero-rated tax case; standard has none. */
  taxNote: Record<Exclude<TaxCase, 'standard'>, string>;

  unit: Record<UnitCode, string>;
}

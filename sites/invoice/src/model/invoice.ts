import type { UnitCode } from './codes';

export type DocLanguage = 'de' | 'en';

/**
 * What the download produces:
 * - 'zugferd'  → hybrid PDF/A-3 with embedded Factur-X CII XML (EN 16931
 *   profile) — the B2B standard, one file for humans and software.
 * - 'xrechnung' → pure CII XML per the XRechnung CIUS — mandatory for
 *   invoices to German public-sector buyers (B2G); requires a Leitweg-ID.
 * Displayed spec versions live in FORMAT_VERSIONS (config.ts).
 */
export type OutputFormat = 'zugferd' | 'xrechnung';

/**
 * The five supported German tax situations. Each maps to a fixed EN 16931 VAT
 * category and a fixed, vetted note text (see doc-i18n) — never free-form.
 */
export type TaxCase =
  | 'standard' //  19 % / 7 % per line               → category S
  | 'kleinunternehmer' // § 19 UStG, no VAT          → category E
  | 'reverse_charge' // § 13b UStG reverse charge    → category AE
  | 'innergem' // innergemeinschaftliche Lieferung   → category K
  | 'export_third'; // Ausfuhr Drittland             → category G

/** Per-line VAT rate in percent. Non-standard tax cases force 0 everywhere. */
export type VatRate = 19 | 7 | 0;

export interface Party {
  name: string;
  street: string;
  postcode: string;
  city: string;
  countryCode: string; // ISO 3166-1 alpha-2
  vatId?: string; // USt-IdNr.  → CII SpecifiedTaxRegistration schemeID VA
  taxNumber?: string; // Steuernummer → schemeID FC
  email?: string;
}

export type LogoSize = 'S' | 'M' | 'L';
export type LogoPosition = 'left' | 'right';

export interface SellerProfile extends Party {
  iban: string;
  bic?: string;
  bankName?: string;
  phone?: string;
  /** Optional logo as data URL (PNG/JPEG), stored in the local profile only. */
  logoDataUrl?: string;
  /** Logo bounding box on the document; defaults to 'M'. */
  logoSize?: LogoSize;
  /** Which side of the letterhead the logo sits on; defaults to 'right'. */
  logoPosition?: LogoPosition;
}

export interface LineItem {
  id: string;
  description: string;
  /** Quantity × 1000 (3 decimal places), always an integer. */
  quantityMilli: number;
  unit: UnitCode;
  /** Unit net price in € × 10 000 (4 decimal places per EN 16931), integer. */
  unitPriceE4: number;
  /** Only meaningful for taxCase 'standard'; forced to 0 otherwise. */
  vatRate: VatRate;
  /**
   * Text-only position: listed with number + description but no own amount —
   * a priced position carries the value for the group. Rendered without
   * qty/price columns; serialized to CII as a zero-amount line (EN 16931
   * requires every invoice line to carry quantity/price/amount, so 0/0.00).
   */
  textOnly?: boolean;
}

export interface Invoice {
  /** Optional for drafts persisted before the field existed → 'zugferd'. */
  outputFormat?: OutputFormat;
  number: string;
  /** ISO date yyyy-mm-dd. */
  issueDate: string;
  /** Leistungs-/Lieferdatum (§ 14 UStG) — either this or servicePeriod. */
  deliveryDate?: string;
  servicePeriod?: { from: string; to: string };
  docLanguage: DocLanguage;
  seller: SellerProfile;
  buyer: Party;
  /** BT-10 Käuferreferenz (required for XRechnung later, optional here). */
  buyerReference?: string;
  lines: LineItem[];
  taxCase: TaxCase;
  /**
   * Payment target in days, or null = no payment-terms sentence on the
   * document. The CII XML then still emits due date = issue date (immediate
   * payability, the § 271 BGB default) to satisfy BR-CO-25.
   */
  paymentTermsDays: number | null;
  /** Free-form closing note printed on the invoice (never legal text). */
  notes?: string;
}

let idCounter = 0;
export function newLineId(): string {
  idCounter += 1;
  return `L${Date.now().toString(36)}${idCounter}`;
}

export function emptyParty(countryCode = 'DE'): Party {
  return { name: '', street: '', postcode: '', city: '', countryCode };
}

export function emptySeller(): SellerProfile {
  return { ...emptyParty(), iban: '' };
}

export function emptyLine(): LineItem {
  return {
    id: newLineId(),
    description: '',
    quantityMilli: 1000,
    unit: 'H87',
    unitPriceE4: 0,
    vatRate: 19,
  };
}

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function outputFormat(invoice: Invoice): OutputFormat {
  return invoice.outputFormat ?? 'zugferd';
}

export function emptyInvoice(seller?: SellerProfile): Invoice {
  const issueDate = todayIso();
  return {
    outputFormat: 'zugferd',
    number: '',
    issueDate,
    deliveryDate: issueDate,
    docLanguage: 'de',
    seller: seller ?? emptySeller(),
    buyer: emptyParty(),
    lines: [emptyLine()],
    taxCase: 'standard',
    paymentTermsDays: 14,
  };
}

/** issueDate + paymentTermsDays, as ISO yyyy-mm-dd (BT-9 due date). */
export function dueDateIso(invoice: Invoice): string {
  const [y, m, d] = invoice.issueDate.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + (invoice.paymentTermsDays ?? 0));
  return date.toISOString().slice(0, 10);
}

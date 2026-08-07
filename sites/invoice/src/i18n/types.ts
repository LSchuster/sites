import type { TaxCase } from '../model/invoice';

/**
 * UI strings (form, buttons, hints). German-only in v1; the typed catalog
 * makes adding an English UI later a compile-checked, mechanical task.
 */
export interface Messages {
  appTitle: string;
  tagline: string;

  themeTitle: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;

  sectionSeller: string;
  sectionBuyer: string;
  sectionMeta: string;
  sectionLines: string;
  sectionPayment: string;
  sectionDownload: string;

  name: string;
  street: string;
  postcode: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  taxNumber: string;
  vatId: string;
  taxIdHint: string;
  iban: string;
  bic: string;
  bankName: string;

  logoLabel: string;
  logoDrop: string;
  logoRemove: string;
  logoError: string;
  logoSize: string;
  logoSizeS: string;
  logoSizeM: string;
  logoSizeL: string;
  logoPosition: string;
  logoLeft: string;
  logoRight: string;

  invoiceNumber: string;
  invoiceNumberHint: string;
  issueDate: string;
  deliveryDate: string;
  usePeriod: string;
  periodFrom: string;
  periodTo: string;
  docLanguage: string;
  docLanguageDe: string;
  docLanguageEn: string;
  buyerReference: string;

  taxCaseLabel: string;
  taxCase: Record<TaxCase, string>;
  taxCaseHint: Record<TaxCase, string>;

  lineDescription: string;
  lineQty: string;
  lineUnit: string;
  lineUnitPrice: string;
  lineVatRate: string;
  lineTextOnly: string;
  lineTextOnlyHint: string;
  addLine: string;
  removeLine: string;

  showPaymentTerms: string;
  paymentTermsDays: string;
  notes: string;
  notesHint: string;

  download: string;
  downloadHint: string;
  print: string;
  generating: string;
  downloadError: string;
  fixIssues: string;

  saveProfile: string;
  profileSaved: string;
  saveClient: string;
  clientSaved: string;
  loadClient: string;
  newInvoice: string;
  exportBackup: string;
  importBackup: string;
  importError: string;

  validation: Record<string, string>;

  previewTitle: string;
  footerDisclaimer: string;
  footerPrivacy: string;
}

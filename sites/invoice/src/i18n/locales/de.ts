import type { Messages } from '../types';

export const de: Messages = {
  appTitle: 'Rechnung schreiben — kostenlos, mit E-Rechnung',
  tagline:
    'PDF + E-Rechnung (ZUGFeRD/Factur-X, EN 16931) in einem Dokument — komplett im Browser. Keine Anmeldung, keine Cloud: Ihre Daten verlassen Ihr Gerät nicht.',

  sectionSeller: 'Ihre Angaben (Rechnungssteller)',
  sectionBuyer: 'Empfänger (Rechnungsadresse)',
  sectionMeta: 'Rechnungsdaten',
  sectionLines: 'Positionen',
  sectionPayment: 'Zahlung & Schlusstext',
  sectionDownload: 'Herunterladen',

  name: 'Name / Firma',
  street: 'Straße und Hausnummer',
  postcode: 'PLZ',
  city: 'Ort',
  country: 'Land',
  email: 'E-Mail',
  phone: 'Telefon',
  taxNumber: 'Steuernummer',
  vatId: 'USt-IdNr.',
  taxIdHint: 'Pflicht: Steuernummer oder USt-IdNr. (§ 14 UStG).',
  iban: 'IBAN',
  bic: 'BIC',
  bankName: 'Bank',

  logoLabel: 'Firmenlogo (optional)',
  logoDrop: 'Logo hierher ziehen oder klicken zum Auswählen',
  logoRemove: 'Logo entfernen',
  logoError: 'Das Bild konnte nicht geladen werden.',
  logoSize: 'Größe',
  logoSizeS: 'Klein',
  logoSizeM: 'Mittel',
  logoSizeL: 'Groß',
  logoPosition: 'Position',
  logoLeft: 'Links',
  logoRight: 'Rechts',

  invoiceNumber: 'Rechnungsnummer',
  invoiceNumberHint: 'Fortlaufend und einmalig (§ 14 UStG), z. B. 2026-001.',
  issueDate: 'Rechnungsdatum',
  deliveryDate: 'Leistungsdatum',
  usePeriod: 'Leistungszeitraum statt Leistungsdatum',
  periodFrom: 'von',
  periodTo: 'bis',
  docLanguage: 'Sprache der Rechnung',
  docLanguageDe: 'Deutsch',
  docLanguageEn: 'Englisch',
  buyerReference: 'Referenz des Empfängers (optional)',

  taxCaseLabel: 'Umsatzsteuer-Fall',
  taxCase: {
    standard: 'Umsatzsteuerpflichtig (19 % / 7 %)',
    kleinunternehmer: 'Kleinunternehmer (§ 19 UStG)',
    reverse_charge: 'Reverse Charge (§ 13b UStG)',
    innergem: 'Innergemeinschaftliche Lieferung',
    export_third: 'Ausfuhr (Drittland)',
  },
  taxCaseHint: {
    standard: 'Der Normalfall: USt. wird je Position mit 19 % oder 7 % ausgewiesen.',
    kleinunternehmer:
      'Keine USt. — die Rechnung erhält den Pflichthinweis nach § 19 UStG.',
    reverse_charge:
      'Steuerschuld geht auf den Empfänger über (z. B. B2B-Dienstleistung ins EU-Ausland). USt-IdNr. des Empfängers erforderlich.',
    innergem:
      'Steuerfreie Warenlieferung an Unternehmen im EU-Ausland. USt-IdNr. beider Seiten erforderlich.',
    export_third: 'Steuerfreie Ausfuhrlieferung in ein Nicht-EU-Land.',
  },

  lineDescription: 'Beschreibung',
  lineQty: 'Menge',
  lineUnit: 'Einheit',
  lineUnitPrice: 'Einzelpreis (netto) €',
  lineVatRate: 'USt.-Satz',
  lineTextOnly: 'Nur Text (ohne Betrag)',
  lineTextOnlyHint:
    'Position wird ohne eigenen Betrag aufgeführt — eine andere Position trägt den Gesamtbetrag (z. B. „Pauschal für Pos. 1–3“).',
  addLine: '+ Position hinzufügen',
  removeLine: 'Position entfernen',

  showPaymentTerms: 'Zahlungsziel auf der Rechnung angeben',
  paymentTermsDays: 'Zahlungsziel (Tage)',
  notes: 'Schlusstext (optional)',
  notesHint: 'z. B. „Vielen Dank für Ihren Auftrag!“',

  download: 'PDF herunterladen (E-Rechnung)',
  downloadHint:
    'Erzeugt eine PDF-Datei, die zugleich eine E-Rechnung ist (PDF/A-3 mit eingebettetem ZUGFeRD/Factur-X-XML, Profil EN 16931).',
  print: 'Drucken',
  generating: 'Wird erzeugt …',
  downloadError:
    'Die PDF-Erzeugung ist fehlgeschlagen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
  fixIssues: 'Bitte vervollständigen Sie die folgenden Angaben:',

  saveProfile: 'Meine Angaben merken',
  profileSaved: 'Gespeichert — wird beim nächsten Besuch vorausgefüllt.',
  saveClient: 'Empfänger merken',
  clientSaved: 'Empfänger gespeichert.',
  loadClient: 'Gespeicherte Empfänger',
  newInvoice: 'Neue Rechnung',
  exportBackup: 'Daten exportieren (JSON)',
  importBackup: 'Daten importieren',
  importError: 'Die Datei konnte nicht gelesen werden (kein gültiges Backup).',

  validation: {
    sellerName: 'Ihr Name bzw. Firmenname fehlt.',
    sellerAddress: 'Ihre vollständige Anschrift fehlt.',
    sellerTaxId: 'Steuernummer oder USt-IdNr. fehlt (§ 14 UStG).',
    sellerIban: 'IBAN fehlt (für den Zahlungsblock).',
    buyerName: 'Name des Empfängers fehlt.',
    buyerAddress: 'Vollständige Anschrift des Empfängers fehlt.',
    number: 'Rechnungsnummer fehlt.',
    issueDate: 'Rechnungsdatum fehlt oder ist ungültig.',
    delivery: 'Leistungsdatum oder Leistungszeitraum fehlt (§ 14 UStG).',
    noLines: 'Mindestens eine Position wird benötigt.',
    needPricedLine: 'Mindestens eine Position mit Betrag wird benötigt (reine Textpositionen tragen keinen Wert).',
    lineDescription: 'Eine Position hat keine Beschreibung.',
    lineQuantity: 'Eine Position hat keine gültige Menge.',
    linePrice: 'Eine Position hat keinen gültigen Einzelpreis.',
    terms: 'Zahlungsziel fehlt oder ist ungültig.',
    innergemSellerVat: 'Innergem. Lieferung: Ihre USt-IdNr. ist erforderlich.',
    innergemBuyerVat: 'Innergem. Lieferung: USt-IdNr. des Empfängers ist erforderlich.',
    innergemCountry: 'Innergem. Lieferung: Empfänger muss im EU-Ausland sitzen.',
    reverseChargeBuyerVat: 'Reverse Charge: USt-IdNr. des Empfängers ist erforderlich.',
    exportCountry: 'Ausfuhr: Empfänger darf nicht in der EU sitzen.',
  },

  previewTitle: 'Vorschau',
  footerDisclaimer:
    'Keine Steuer- oder Rechtsberatung. Prüfen Sie Rechnungen vor dem Versand.',
  footerPrivacy: 'Alle Daten bleiben in Ihrem Browser (localStorage).',
};

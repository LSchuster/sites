import type { DocMessages } from './types';

export const de: DocMessages = {
  invoiceTitle: 'Rechnung',
  invoiceNo: 'Rechnungsnummer',
  issueDate: 'Rechnungsdatum',
  deliveryDate: 'Leistungsdatum',
  servicePeriod: 'Leistungszeitraum',
  buyerReference: 'Ihre Referenz',
  page: (n, of) => `Seite ${n} von ${of}`,

  colPos: 'Pos.',
  colDescription: 'Beschreibung',
  colQty: 'Menge',
  colUnit: 'Einheit',
  colUnitPrice: 'Einzelpreis',
  colVat: 'USt.',
  colNet: 'Betrag',

  sumNet: 'Summe netto',
  sumVat: (rate) => `zzgl. ${rate} % USt.`,
  sumGross: 'Rechnungsbetrag',

  paymentHeading: 'Zahlung',
  paymentTerms: (days, due) =>
    `Zahlbar innerhalb von ${days} Tagen ohne Abzug bis zum ${due}.`,
  paymentTermsImmediate: 'Zahlbar sofort ohne Abzug.',
  bank: 'Bank',
  iban: 'IBAN',
  bic: 'BIC',

  sellerTaxNumber: 'Steuernummer',
  sellerVatId: 'USt-IdNr.',
  phone: 'Tel.',
  email: 'E-Mail',

  taxNote: {
    kleinunternehmer: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
    reverse_charge:
      'Steuerschuldnerschaft des Leistungsempfängers (Reverse-Charge-Verfahren, § 13b UStG).',
    innergem:
      'Steuerfreie innergemeinschaftliche Lieferung (§ 4 Nr. 1 Buchst. b i. V. m. § 6a UStG).',
    export_third:
      'Steuerfreie Ausfuhrlieferung (§ 4 Nr. 1 Buchst. a i. V. m. § 6 UStG).',
  },

  unit: {
    H87: 'Stk.',
    C62: 'Einh.',
    HUR: 'Std.',
    DAY: 'Tag(e)',
    MON: 'Monat(e)',
    KGM: 'kg',
    MTR: 'm',
    KMT: 'km',
    MTK: 'm²',
    LTR: 'l',
  },
};

import type { DocMessages } from './types';

export const en: DocMessages = {
  invoiceTitle: 'Invoice',
  invoiceNo: 'Invoice no.',
  issueDate: 'Invoice date',
  deliveryDate: 'Date of supply',
  servicePeriod: 'Service period',
  buyerReference: 'Your reference',
  page: (n, of) => `Page ${n} of ${of}`,

  colPos: 'No.',
  colDescription: 'Description',
  colQty: 'Qty',
  colUnit: 'Unit',
  colUnitPrice: 'Unit price',
  colVat: 'VAT',
  colNet: 'Amount',

  sumNet: 'Subtotal (net)',
  sumVat: (rate) => `VAT ${rate} %`,
  sumGross: 'Total due',

  paymentHeading: 'Payment',
  paymentTerms: (days, due) => `Payable within ${days} days net, due by ${due}.`,
  paymentTermsImmediate: 'Payable immediately, net.',
  bank: 'Bank',
  iban: 'IBAN',
  bic: 'BIC',

  sellerTaxNumber: 'Tax number',
  sellerVatId: 'VAT ID',
  phone: 'Phone',
  email: 'Email',

  taxNote: {
    kleinunternehmer:
      'No VAT charged pursuant to § 19 UStG (German small business scheme).',
    reverse_charge: 'VAT liability of the recipient (reverse charge, § 13b UStG).',
    innergem: 'VAT-exempt intra-Community supply (§ 4 no. 1(b) in conjunction with § 6a UStG).',
    export_third: 'VAT-exempt export supply (§ 4 no. 1(a) in conjunction with § 6 UStG).',
  },

  unit: {
    H87: 'pcs',
    C62: 'unit(s)',
    HUR: 'h',
    DAY: 'day(s)',
    MON: 'month(s)',
    KGM: 'kg',
    MTR: 'm',
    KMT: 'km',
    MTK: 'm²',
    LTR: 'l',
  },
};

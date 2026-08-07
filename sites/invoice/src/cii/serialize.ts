import { docMessages, formatDate } from '../doc-i18n';
import { computeTotals } from '../model/compute';
import type { Invoice, Party } from '../model/invoice';
import { dueDateIso } from '../model/invoice';
import { effectiveRate, needsExemptionReason, VAT_CATEGORY } from '../model/taxcases';

/**
 * Serialize an Invoice into EN 16931 UN/CEFACT CII XML (the Factur-X /
 * ZUGFeRD "EN 16931" profile payload, embedded as factur-x.xml).
 *
 * Hand-written on purpose: the model is small and fully constrained by the
 * form, so a typed template beats an XML dependency. Element ORDER inside
 * each aggregate follows the CII D16B schema sequence — do not reorder.
 * Conformance is proven by the Mustang/veraPDF golden-sample validation
 * (npm run validate:einvoice), not assumed.
 */

const GUIDELINE_URN = 'urn:cen.eu:en16931:2017';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Integer cents → "1234.56" (BT amounts are 2 dp, dot separator). */
function cents(c: number): string {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Integer €×10⁴ → unit price, 2 dp or 4 dp when sub-cent precision is used. */
function price(e4: number): string {
  return e4 % 100 === 0 ? (e4 / 10_000).toFixed(2) : (e4 / 10_000).toFixed(4);
}

/** Integer quantity ×10³ → decimal string, trailing zeros trimmed. */
function qty(quantityMilli: number): string {
  return (quantityMilli / 1000)
    .toFixed(3)
    .replace(/\.?0+$/, '')
    .replace(/^$/, '0');
}

/** ISO yyyy-mm-dd → CII format 102 (YYYYMMDD). */
function date102(iso: string): string {
  return `<udt:DateTimeString format="102">${iso.replaceAll('-', '')}</udt:DateTimeString>`;
}

function postalAddress(p: Party): string {
  return `<ram:PostalTradeAddress>
<ram:PostcodeCode>${esc(p.postcode)}</ram:PostcodeCode>
<ram:LineOne>${esc(p.street)}</ram:LineOne>
<ram:CityName>${esc(p.city)}</ram:CityName>
<ram:CountryID>${esc(p.countryCode)}</ram:CountryID>
</ram:PostalTradeAddress>`;
}

function electronicAddress(p: Party): string {
  return p.email
    ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(p.email)}</ram:URIID></ram:URIUniversalCommunication>`
    : '';
}

export function serializeCii(invoice: Invoice): string {
  const totals = computeTotals(invoice);
  const doc = docMessages(invoice.docLanguage);
  const category = VAT_CATEGORY[invoice.taxCase];
  const exemptionReason = needsExemptionReason(invoice.taxCase)
    ? doc.taxNote[invoice.taxCase as Exclude<Invoice['taxCase'], 'standard'>]
    : undefined;

  const seller = invoice.seller;
  const buyer = invoice.buyer;
  const due = dueDateIso(invoice);
  // null = no terms on the document; the XML still gets due date = issue date
  // (immediate payability, § 271 BGB default) so BR-CO-25 holds.
  const paymentText =
    invoice.paymentTermsDays === null
      ? null
      : invoice.paymentTermsDays === 0
        ? doc.paymentTermsImmediate
        : doc.paymentTerms(invoice.paymentTermsDays, formatDate(due, invoice.docLanguage));

  const notes: string[] = [];
  if (exemptionReason) notes.push(exemptionReason);
  if (invoice.notes?.trim()) notes.push(invoice.notes.trim());

  const lines = invoice.lines
    .map((line, i) => {
      // Text-only positions become zero-amount lines: EN 16931 requires every
      // line to carry quantity/price/amount (BR-25/26/24), so 0 / 0.00 / 0.00.
      // Under category S the line rate must still be > 0 (BR-S-5).
      const lineRate =
        line.textOnly && invoice.taxCase === 'standard' ? 19 : line.vatRate;
      const rate = effectiveRate(invoice.taxCase, lineRate);
      const net = totals.lineNetCents.get(line.id) ?? 0;
      const unitCode = line.textOnly ? 'C62' : line.unit;
      const quantity = line.textOnly ? '0' : qty(line.quantityMilli);
      const unitPrice = line.textOnly ? '0.00' : price(line.unitPriceE4);
      return `<ram:IncludedSupplyChainTradeLineItem>
<ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
<ram:SpecifiedTradeProduct><ram:Name>${esc(line.description)}</ram:Name></ram:SpecifiedTradeProduct>
<ram:SpecifiedLineTradeAgreement>
<ram:NetPriceProductTradePrice><ram:ChargeAmount>${unitPrice}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
</ram:SpecifiedLineTradeAgreement>
<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${unitCode}">${quantity}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
<ram:SpecifiedLineTradeSettlement>
<ram:ApplicableTradeTax>
<ram:TypeCode>VAT</ram:TypeCode>
<ram:CategoryCode>${category}</ram:CategoryCode>
<ram:RateApplicablePercent>${rate.toFixed(2)}</ram:RateApplicablePercent>
</ram:ApplicableTradeTax>
<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${cents(net)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
</ram:SpecifiedLineTradeSettlement>
</ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join('\n');

  const taxRegistrations = [
    seller.taxNumber?.trim()
      ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(seller.taxNumber.trim())}</ram:ID></ram:SpecifiedTaxRegistration>`
      : '',
    seller.vatId?.trim()
      ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(seller.vatId.trim())}</ram:ID></ram:SpecifiedTaxRegistration>`
      : '',
  ].join('');

  const headerTaxes = totals.byRate
    .map((g) => {
      const reason = exemptionReason
        ? `<ram:ExemptionReason>${esc(exemptionReason)}</ram:ExemptionReason>`
        : '';
      return `<ram:ApplicableTradeTax>
<ram:CalculatedAmount>${cents(g.vatCents)}</ram:CalculatedAmount>
<ram:TypeCode>VAT</ram:TypeCode>
${reason}<ram:BasisAmount>${cents(g.basisCents)}</ram:BasisAmount>
<ram:CategoryCode>${g.category}</ram:CategoryCode>
<ram:RateApplicablePercent>${g.rate.toFixed(2)}</ram:RateApplicablePercent>
</ram:ApplicableTradeTax>`;
    })
    .join('\n');

  const billingPeriod = invoice.servicePeriod
    ? `<ram:BillingSpecifiedPeriod>
<ram:StartDateTime>${date102(invoice.servicePeriod.from)}</ram:StartDateTime>
<ram:EndDateTime>${date102(invoice.servicePeriod.to)}</ram:EndDateTime>
</ram:BillingSpecifiedPeriod>`
    : '';

  // BR-IC-12: intra-community supply requires a deliver-to country (BT-80).
  const shipTo =
    invoice.taxCase === 'innergem'
      ? `<ram:ShipToTradeParty><ram:PostalTradeAddress><ram:CountryID>${esc(buyer.countryCode)}</ram:CountryID></ram:PostalTradeAddress></ram:ShipToTradeParty>`
      : '';
  const deliveryEvent = invoice.deliveryDate
    ? `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime>${date102(invoice.deliveryDate)}</ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>`
    : '';
  // Self-closing when empty — PEPPOL-EN16931-R008 flags empty elements.
  const delivery =
    shipTo || deliveryEvent
      ? `<ram:ApplicableHeaderTradeDelivery>\n${[shipTo, deliveryEvent].filter(Boolean).join('\n')}\n</ram:ApplicableHeaderTradeDelivery>`
      : '<ram:ApplicableHeaderTradeDelivery/>';

  const bic = seller.bic?.trim()
    ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${esc(seller.bic.trim())}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
<rsm:ExchangedDocumentContext>
<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${GUIDELINE_URN}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
</rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument>
<ram:ID>${esc(invoice.number)}</ram:ID>
<ram:TypeCode>380</ram:TypeCode>
<ram:IssueDateTime>${date102(invoice.issueDate)}</ram:IssueDateTime>
${notes.map((n) => `<ram:IncludedNote><ram:Content>${esc(n)}</ram:Content></ram:IncludedNote>`).join('\n')}
</rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>
${lines}
<ram:ApplicableHeaderTradeAgreement>
${invoice.buyerReference?.trim() ? `<ram:BuyerReference>${esc(invoice.buyerReference.trim())}</ram:BuyerReference>` : ''}
<ram:SellerTradeParty>
${!seller.vatId?.trim() && seller.taxNumber?.trim() ? `<ram:ID>${esc(seller.taxNumber.trim())}</ram:ID>` : ''}<ram:Name>${esc(seller.name)}</ram:Name>
${postalAddress(seller)}
${electronicAddress(seller)}
${taxRegistrations}
</ram:SellerTradeParty>
<ram:BuyerTradeParty>
<ram:Name>${esc(buyer.name)}</ram:Name>
${postalAddress(buyer)}
${electronicAddress(buyer)}
${buyer.vatId?.trim() ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(buyer.vatId.trim())}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
</ram:BuyerTradeParty>
</ram:ApplicableHeaderTradeAgreement>
${delivery}
<ram:ApplicableHeaderTradeSettlement>
<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
<ram:SpecifiedTradeSettlementPaymentMeans>
<ram:TypeCode>58</ram:TypeCode>
<ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(seller.iban.replaceAll(' ', ''))}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>
${bic}
</ram:SpecifiedTradeSettlementPaymentMeans>
${headerTaxes}
${billingPeriod}
<ram:SpecifiedTradePaymentTerms>
${paymentText ? `<ram:Description>${esc(paymentText)}</ram:Description>\n` : ''}<ram:DueDateDateTime>${date102(due)}</ram:DueDateDateTime>
</ram:SpecifiedTradePaymentTerms>
<ram:SpecifiedTradeSettlementHeaderMonetarySummation>
<ram:LineTotalAmount>${cents(totals.netCents)}</ram:LineTotalAmount>
<ram:TaxBasisTotalAmount>${cents(totals.netCents)}</ram:TaxBasisTotalAmount>
<ram:TaxTotalAmount currencyID="EUR">${cents(totals.vatCents)}</ram:TaxTotalAmount>
<ram:GrandTotalAmount>${cents(totals.grossCents)}</ram:GrandTotalAmount>
<ram:DuePayableAmount>${cents(totals.grossCents)}</ram:DuePayableAmount>
</ram:SpecifiedTradeSettlementHeaderMonetarySummation>
</ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}

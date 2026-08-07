import {
  docMessages,
  formatCents,
  formatDate,
  formatQuantity,
  formatUnitPrice,
} from '../doc-i18n';
import { t } from '../i18n';
import { computeTotals } from '../model/compute';
import type { Invoice } from '../model/invoice';
import { dueDateIso } from '../model/invoice';
import { effectiveRate, isZeroRated } from '../model/taxcases';

/**
 * Live HTML preview mirroring the PDF's DIN 5008 structure (not a rendered
 * PDF — instant, and keeps the CSP free of blob: frames). The PDF is the
 * source of truth; this only mirrors it.
 */
export function Preview(props: { invoice: Invoice }) {
  const { invoice } = props;
  const doc = docMessages(invoice.docLanguage);
  const totals = computeTotals(invoice);
  const showVat = !isZeroRated(invoice.taxCase);
  const s = invoice.seller;
  const b = invoice.buyer;
  const due = dueDateIso(invoice);

  const infoRows: Array<[string, string]> = [[doc.invoiceNo, invoice.number || '—']];
  infoRows.push([doc.issueDate, formatDate(invoice.issueDate, invoice.docLanguage)]);
  if (invoice.servicePeriod) {
    infoRows.push([
      doc.servicePeriod,
      `${formatDate(invoice.servicePeriod.from, invoice.docLanguage)} – ${formatDate(invoice.servicePeriod.to, invoice.docLanguage)}`,
    ]);
  } else if (invoice.deliveryDate) {
    infoRows.push([doc.deliveryDate, formatDate(invoice.deliveryDate, invoice.docLanguage)]);
  }
  if (invoice.buyerReference?.trim()) infoRows.push([doc.buyerReference, invoice.buyerReference]);
  if (s.taxNumber?.trim()) infoRows.push([doc.sellerTaxNumber, s.taxNumber]);
  if (s.vatId?.trim()) infoRows.push([doc.sellerVatId, s.vatId]);

  return (
    <div className="preview-wrap">
      <h2>{t.previewTitle}</h2>
      <div className="sheet" lang={invoice.docLanguage}>
        {s.logoDataUrl ? <img className="sheet-logo" src={s.logoDataUrl} alt="" /> : null}
        <p className="sheet-return">
          {[s.name, s.street, `${s.postcode} ${s.city}`.trim()].filter(Boolean).join(' · ')}
        </p>
        <div className="sheet-head">
          <div className="sheet-address">
            <p>{b.name}</p>
            <p>{b.street}</p>
            <p>
              {b.postcode} {b.city}
            </p>
          </div>
          <table className="sheet-info">
            <tbody>
              {infoRows.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="sheet-title">
          {doc.invoiceTitle} {invoice.number}
        </h3>

        <table className="sheet-lines">
          <thead>
            <tr>
              <th>{doc.colPos}</th>
              <th className="wide">{doc.colDescription}</th>
              <th className="num">{doc.colQty}</th>
              <th>{doc.colUnit}</th>
              <th className="num">{doc.colUnitPrice}</th>
              {showVat ? <th className="num">{doc.colVat}</th> : null}
              <th className="num">{doc.colNet}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) =>
              line.textOnly ? (
                <tr key={line.id}>
                  <td>{i + 1}</td>
                  <td className="wide" colSpan={showVat ? 6 : 5}>
                    {line.description || '—'}
                  </td>
                </tr>
              ) : (
                <tr key={line.id}>
                  <td>{i + 1}</td>
                  <td className="wide">{line.description || '—'}</td>
                  <td className="num">{formatQuantity(line.quantityMilli, invoice.docLanguage)}</td>
                  <td>{doc.unit[line.unit]}</td>
                  <td className="num">{formatUnitPrice(line.unitPriceE4, invoice.docLanguage)}</td>
                  {showVat ? (
                    <td className="num">{effectiveRate(invoice.taxCase, line.vatRate)} %</td>
                  ) : null}
                  <td className="num">
                    {formatCents(totals.lineNetCents.get(line.id) ?? 0, invoice.docLanguage)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        <div className="sheet-totals">
          <div>
            <span>{doc.sumNet}</span>
            <span>{formatCents(totals.netCents, invoice.docLanguage)}</span>
          </div>
          {showVat
            ? totals.byRate.map((g) => (
                <div key={g.rate}>
                  <span>{doc.sumVat(g.rate)}</span>
                  <span>{formatCents(g.vatCents, invoice.docLanguage)}</span>
                </div>
              ))
            : null}
          <div className="grand">
            <span>{doc.sumGross}</span>
            <span>{formatCents(totals.grossCents, invoice.docLanguage)}</span>
          </div>
        </div>

        <div className="sheet-notes">
          {isZeroRated(invoice.taxCase) ? (
            <p>{doc.taxNote[invoice.taxCase as Exclude<Invoice['taxCase'], 'standard'>]}</p>
          ) : null}
          {invoice.paymentTermsDays !== null ? (
            <p>
              {invoice.paymentTermsDays === 0
                ? doc.paymentTermsImmediate
                : doc.paymentTerms(
                    invoice.paymentTermsDays,
                    formatDate(due, invoice.docLanguage),
                  )}
            </p>
          ) : null}
          {invoice.notes?.trim() ? <p>{invoice.notes}</p> : null}
        </div>

        <div className="sheet-footer">
          <div>
            <p>{s.name}</p>
            <p>{s.street}</p>
            <p>
              {s.postcode} {s.city}
            </p>
          </div>
          <div>
            {s.phone?.trim() ? (
              <p>
                {doc.phone} {s.phone}
              </p>
            ) : null}
            {s.email?.trim() ? (
              <p>
                {doc.email} {s.email}
              </p>
            ) : null}
            {s.taxNumber?.trim() ? (
              <p>
                {doc.sellerTaxNumber}: {s.taxNumber}
              </p>
            ) : null}
            {s.vatId?.trim() ? (
              <p>
                {doc.sellerVatId} {s.vatId}
              </p>
            ) : null}
          </div>
          <div>
            {s.bankName?.trim() ? <p>{s.bankName}</p> : null}
            <p>
              {doc.iban} {s.iban}
            </p>
            {s.bic?.trim() ? (
              <p>
                {doc.bic} {s.bic}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

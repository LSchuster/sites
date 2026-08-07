import { t } from '../i18n';
import { docMessages } from '../doc-i18n';
import { UNIT_CODES } from '../model/codes';
import type { Invoice, VatRate } from '../model/invoice';
import { isZeroRated } from '../model/taxcases';
import { addLine, removeLine, updateLine } from '../state/store';

export function LineItems(props: { invoice: Invoice }) {
  const { invoice } = props;
  const showVat = !isZeroRated(invoice.taxCase);
  const doc = docMessages('de'); // unit labels in the (German) UI

  return (
    <div className="lines">
      {invoice.lines.map((line, i) => (
        <div className="line-card" key={line.id}>
          <div className="line-head">
            <span className="line-no">{i + 1}</span>
            {invoice.lines.length > 1 ? (
              <button
                type="button"
                className="ghost danger"
                onClick={() => removeLine(line.id)}
                aria-label={`${t.removeLine} ${i + 1}`}
              >
                ×
              </button>
            ) : null}
          </div>
          <label className="field grow">
            <span className="field-label">{t.lineDescription}</span>
            <textarea
              rows={2}
              value={line.description}
              onChange={(e) => updateLine(line.id, { description: e.target.value })}
            />
          </label>
          <label className="check" title={t.lineTextOnlyHint}>
            <input
              type="checkbox"
              checked={!!line.textOnly}
              onChange={(e) => updateLine(line.id, { textOnly: e.target.checked })}
            />
            {t.lineTextOnly}
          </label>
          {line.textOnly ? null : (
          <div className="row">
            <label className="field">
              <span className="field-label">{t.lineQty}</span>
              <input
                type="number"
                min={0}
                step="any"
                value={line.quantityMilli / 1000}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value) * 1000);
                  updateLine(line.id, { quantityMilli: Number.isFinite(v) && v >= 0 ? v : 0 });
                }}
              />
            </label>
            <label className="field">
              <span className="field-label">{t.lineUnit}</span>
              <select
                value={line.unit}
                onChange={(e) =>
                  updateLine(line.id, { unit: e.target.value as (typeof UNIT_CODES)[number] })
                }
              >
                {UNIT_CODES.map((u) => (
                  <option key={u} value={u}>
                    {doc.unit[u]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t.lineUnitPrice}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={line.unitPriceE4 / 10_000}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value) * 10_000);
                  updateLine(line.id, { unitPriceE4: Number.isFinite(v) && v >= 0 ? v : 0 });
                }}
              />
            </label>
            {showVat ? (
              <label className="field">
                <span className="field-label">{t.lineVatRate}</span>
                <select
                  value={line.vatRate}
                  onChange={(e) =>
                    updateLine(line.id, { vatRate: Number(e.target.value) as VatRate })
                  }
                >
                  <option value={19}>19 %</option>
                  <option value={7}>7 %</option>
                </select>
              </label>
            ) : null}
          </div>
          )}
        </div>
      ))}
      <button type="button" className="ghost" onClick={addLine}>
        {t.addLine}
      </button>
    </div>
  );
}

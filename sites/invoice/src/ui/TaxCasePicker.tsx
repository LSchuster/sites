import { t } from '../i18n';
import type { Invoice, TaxCase } from '../model/invoice';
import { updateInvoice } from '../state/store';
import { Field } from './Field';

const CASES: TaxCase[] = [
  'standard',
  'kleinunternehmer',
  'reverse_charge',
  'innergem',
  'export_third',
];

export function TaxCasePicker(props: { invoice: Invoice }) {
  const { invoice } = props;
  return (
    <Field label={t.taxCaseLabel} hint={t.taxCaseHint[invoice.taxCase]} grow>
      <select
        value={invoice.taxCase}
        onChange={(e) => updateInvoice({ taxCase: e.target.value as TaxCase })}
      >
        {CASES.map((c) => (
          <option key={c} value={c}>
            {t.taxCase[c]}
          </option>
        ))}
      </select>
    </Field>
  );
}

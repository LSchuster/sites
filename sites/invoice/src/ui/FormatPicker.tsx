import { FORMAT_VERSIONS } from '../config';
import { t } from '../i18n';
import type { Invoice, OutputFormat } from '../model/invoice';
import { outputFormat } from '../model/invoice';
import { updateInvoice } from '../state/store';

/**
 * Header above the form: explains the two output formats (with their spec
 * versions) and switches what the download produces.
 */
export function FormatPicker(props: { invoice: Invoice }) {
  const current = outputFormat(props.invoice);

  const options: Array<{
    value: OutputFormat;
    title: string;
    desc: string;
    version: string;
  }> = [
    {
      value: 'zugferd',
      title: t.formatZugferd,
      desc: t.formatZugferdDesc,
      version: FORMAT_VERSIONS.zugferd,
    },
    {
      value: 'xrechnung',
      title: t.formatXrechnung,
      desc: t.formatXrechnungDesc,
      version: FORMAT_VERSIONS.xrechnung,
    },
  ];

  return (
    <section className="format-picker" aria-labelledby="format-heading">
      <h2 id="format-heading">{t.formatHeading}</h2>
      <div className="format-options" role="radiogroup" aria-labelledby="format-heading">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={current === opt.value ? 'format-card selected' : 'format-card'}
          >
            <input
              type="radio"
              name="output-format"
              value={opt.value}
              checked={current === opt.value}
              onChange={() => updateInvoice({ outputFormat: opt.value })}
            />
            <span className="format-title">{opt.title}</span>
            <span className="format-version">{opt.version}</span>
            <span className="format-desc">{opt.desc}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

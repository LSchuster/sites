import { useState } from 'react';
import { MONETIZATION } from '../config';
import { t } from '../i18n';
import type { Invoice } from '../model/invoice';
import { validateInvoice } from '../model/validate';
import { bumpSequence } from '../state/store';

type Status = 'idle' | 'working' | 'done' | 'error';

export function DownloadPanel(props: { invoice: Invoice }) {
  const { invoice } = props;
  const [status, setStatus] = useState<Status>('idle');
  const issues = validateInvoice(invoice);

  async function download() {
    setStatus('working');
    try {
      // The PDF stack (~pdf-lib + fonts) is the app's one heavy chunk — lazy.
      const { generateInvoicePdf, invoiceFileName } = await import('../pdf/generate');
      const bytes = await generateInvoicePdf(invoice);
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = invoiceFileName(invoice);
      a.click();
      URL.revokeObjectURL(url);
      bumpSequence();
      setStatus('done');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }

  return (
    <section className="download-panel" aria-labelledby="download-heading">
      <h2 id="download-heading">{t.sectionDownload}</h2>
      {issues.length > 0 ? (
        <div className="issues" role="alert">
          <p>{t.fixIssues}</p>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.field}:${issue.key}`}>{t.validation[issue.key] ?? issue.key}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        className="primary"
        disabled={issues.length > 0 || status === 'working'}
        onClick={download}
      >
        {status === 'working' ? t.generating : t.download}
      </button>
      <p className="field-hint">{t.downloadHint}</p>
      {status === 'error' ? (
        <p className="error" role="alert">
          {t.downloadError}
        </p>
      ) : null}

      {status === 'done' && MONETIZATION.affiliatesEnabled && MONETIZATION.affiliates.length > 0 ? (
        <aside className="affiliate-card">
          <p className="affiliate-label">Anzeige · Affiliate-Links</p>
          <p>Wenn Sie regelmäßig Rechnungen schreiben, lohnt sich Buchhaltungssoftware:</p>
          <ul>
            {MONETIZATION.affiliates.map((a) => (
              <li key={a.name}>
                <a href={a.url} rel="sponsored noopener" target="_blank">
                  {a.name}
                </a>{' '}
                — {a.blurb}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </section>
  );
}

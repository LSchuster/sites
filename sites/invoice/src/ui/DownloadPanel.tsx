import { useEffect, useRef, useState } from 'react';
import { MONETIZATION } from '../config';
import { t } from '../i18n';
import type { Invoice } from '../model/invoice';
import { validateInvoice } from '../model/validate';
import { bumpSequence } from '../state/store';

type Status = 'idle' | 'working' | 'done' | 'error';

async function generatePdfUrl(invoice: Invoice): Promise<{ url: string; name: string }> {
  // The PDF stack (~pdf-lib + fonts) is the app's one heavy chunk — lazy.
  const { generateInvoicePdf, invoiceFileName } = await import('../pdf/generate');
  const bytes = await generateInvoicePdf(invoice);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: 'application/pdf' });
  return { url: URL.createObjectURL(blob), name: invoiceFileName(invoice) };
}

export function DownloadPanel(props: { invoice: Invoice }) {
  const { invoice } = props;
  const [status, setStatus] = useState<Status>('idle');
  const issues = validateInvoice(invoice);
  // The print iframe (and its blob URL) must outlive the print dialog; both
  // are cleaned up on the next print or on unmount.
  const printFrame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => () => cleanupPrintFrame(), []);

  function cleanupPrintFrame() {
    if (printFrame.current) {
      URL.revokeObjectURL(printFrame.current.src);
      printFrame.current.remove();
      printFrame.current = null;
    }
  }

  async function download() {
    setStatus('working');
    try {
      const { url, name } = await generatePdfUrl(invoice);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      bumpSequence();
      setStatus('done');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }

  async function print() {
    setStatus('working');
    try {
      const { url } = await generatePdfUrl(invoice);
      cleanupPrintFrame();
      // Hidden iframe → browser PDF viewer → print dialog. Requires
      // `frame-src blob:` in the CSP (public/_headers). Fallback: new tab.
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden;';
      iframe.src = url;
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            window.open(url, '_blank');
          }
        }, 250);
      };
      document.body.appendChild(iframe);
      printFrame.current = iframe;
      setStatus('idle');
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
      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={issues.length > 0 || status === 'working'}
          onClick={download}
        >
          {status === 'working' ? t.generating : t.download}
        </button>
        <button
          type="button"
          className="ghost tall"
          disabled={issues.length > 0 || status === 'working'}
          onClick={print}
        >
          {t.print}
        </button>
      </div>
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

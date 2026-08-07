import { t } from './i18n';
import { useAppState } from './state/store';
import { DownloadPanel } from './ui/DownloadPanel';
import { Footer } from './ui/Footer';
import { InvoiceForm } from './ui/InvoiceForm';
import { Preview } from './ui/Preview';

export function App() {
  const { invoice } = useAppState();
  return (
    <main className="shell">
      <header className="masthead">
        <h1>{t.appTitle}</h1>
        <p className="tagline">{t.tagline}</p>
      </header>
      <div className="workspace">
        <div className="pane-form">
          <InvoiceForm invoice={invoice} />
          <DownloadPanel invoice={invoice} />
        </div>
        <div className="pane-preview">
          <Preview invoice={invoice} />
        </div>
      </div>
      <Footer />
    </main>
  );
}

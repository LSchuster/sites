import { useAppState } from './state/store';
import { DownloadPanel } from './ui/DownloadPanel';
import { FormatPicker } from './ui/FormatPicker';
import { InvoiceForm } from './ui/InvoiceForm';
import { Preview } from './ui/Preview';

/**
 * The generator app. React owns only #root — the page shell around it
 * (header, hero, SEO sections, footer, theme toggle) is static Astro in
 * src/pages/index.astro.
 */
export function App() {
  const { invoice } = useAppState();
  return (
    <div className="app">
      <FormatPicker invoice={invoice} />
      <div className="workspace">
        <div className="pane-form">
          <InvoiceForm invoice={invoice} />
          <DownloadPanel invoice={invoice} />
        </div>
        <div className="pane-preview">
          <Preview invoice={invoice} />
        </div>
      </div>
    </div>
  );
}

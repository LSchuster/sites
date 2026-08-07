import { useState } from 'react';
import { MapCanvas } from './map/MapCanvas.tsx';
import { Legend } from './map/Legend.tsx';
import { Tooltip } from './map/Tooltip.tsx';
import { CountryCard } from './map/CountryCard.tsx';
import { ConflictPanel } from './panel/ConflictPanel.tsx';
import { Timeline } from './timeline/Timeline.tsx';
import { SearchBar } from './ui/SearchBar.tsx';
import { About } from './ui/About.tsx';
import { Loading } from './ui/Loading.tsx';
import { LanguageSwitcher } from './ui/LanguageSwitcher.tsx';
import { useT } from './i18n/index.ts';

export function App(): React.JSX.Element {
  const [aboutOpen, setAboutOpen] = useState(false);
  const t = useT();

  return (
    <div className="app">
      <div className="stage">
        <MapCanvas />

        {/* A scrim under the top-left and top-right controls. Without it, labels
            sit directly on coastlines and legibility depends on where you scroll. */}
        <div className="stage__scrim" aria-hidden="true" />

        {/* Before the masthead in the DOM so `.country ~ .masthead` can fade it
            out — they share the top-left corner. */}
        <CountryCard />

        <header className="masthead">
          <h1 className="masthead__title">
            {t.app.title}
            <span className="masthead__dot" />
          </h1>
          <p className="masthead__sub">{t.app.tagline}</p>
          <div className="masthead__actions">
            <button className="masthead__about" onClick={() => setAboutOpen(true)}>
              {t.app.about}
            </button>
            <LanguageSwitcher />
          </div>
        </header>

        <SearchBar />
        <Legend />
        <Tooltip />
        <ConflictPanel />
      </div>

      <Timeline />
      {aboutOpen && <About onClose={() => setAboutOpen(false)} />}
      <Loading />
    </div>
  );
}

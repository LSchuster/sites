import { useEffect, useRef } from 'react';
import { useAtlas, setState } from '../state/store.ts';
import { getById, localized, localizedMembers, localizedSide } from '../data/conflicts.ts';
import { worldPopulation } from '../data/population.ts';
import { useLocale, useT } from '../i18n/index.ts';
import { formatDeaths, formatShare, formatYears } from '../i18n/format.ts';
import { OpposedBars, ExtraSides } from './OpposedBars.tsx';

export function ConflictPanel(): React.JSX.Element | null {
  const selectedId = useAtlas((s) => s.selectedId);
  const t = useT();
  const locale = useLocale();
  const conflict = getById(selectedId);

  // Escape closes, and focus goes back to wherever it was before the panel
  // opened — usually the search box or a country-card row.
  const restoreRef = useRef<HTMLElement | null>(null);
  const open = conflict != null;
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState({ selectedId: null });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!conflict) return null;

  const { total, sides } = conflict;
  const text = localized(conflict, locale);
  const midYear = Math.round((conflict.startYear + conflict.endYear) / 2);
  const share = total.best / worldPopulation(midYear);
  const parent = conflict.partOf ? getById(conflict.partOf) : null;
  const duration = conflict.endYear - conflict.startYear + 1;

  return (
    <aside className="panel" aria-label={text.name}>
      <button className="panel__close" onClick={() => setState({ selectedId: null })} aria-label={t.panel.close}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <div className="panel__scroll">
        <header className="panel__head">
          <h2 className="panel__title">{text.name}</h2>
          <div className="panel__meta">
            <span className="panel__badge">{t.types[conflict.type]}</span>
            <span className="panel__region">{text.region}</span>
          </div>
          {parent && (
            <p className="panel__nested">
              {t.panel.partOf} <em>{localized(parent, locale).name}</em>
            </p>
          )}
        </header>

        <section className="panel__facts">
          <div className="panel__fact">
            <div className="panel__fact-value">
              {formatYears(conflict.startYear, conflict.endYear, t)}
            </div>
            <div className="panel__fact-label">
              {t.panel.duration}: {duration} {duration === 1 ? t.panel.yearOne : t.panel.yearMany}
            </div>
          </div>
          <div className="panel__fact">
            <div className="panel__fact-value">{formatShare(share, t)}</div>
            <div className="panel__fact-label">
              {t.panel.ofEveryoneAlive} {midYear}
              <br />
              <span className="panel__share-sub">
                {t.panel.worldPopulation} ≈ {formatDeaths(worldPopulation(midYear), t)}
              </span>
            </div>
          </div>
          <div className="panel__fact">
            <div className={`panel__confidence panel__confidence--${total.confidence}`}>
              {t.confidence[total.confidence]}
            </div>
          </div>
        </section>

        <section className="panel__hero">
          <div className="panel__hero-value">{formatDeaths(total.best, t)}</div>
          <div className="panel__hero-label">{t.panel.estimatedDeaths}</div>
          <div className="panel__range">
            <span>{formatDeaths(total.low, t)}</span>
            <span className="panel__range-bar" aria-hidden="true">
              <span className="panel__range-dot" />
            </span>
            <span>{formatDeaths(total.high, t)}</span>
          </div>
        </section>

        {text.summary && <p className="panel__summary">{text.summary}</p>}

        {sides.length >= 2 && (
          <section className="panel__section">
            <h3 className="panel__h3">{t.panel.casualtiesBySide}</h3>
            <OpposedBars conflict={conflict} />
            <ExtraSides conflict={conflict} />
          </section>
        )}

        {sides.some((s) => s.members?.length) && (
          <section className="panel__section">
            <h3 className="panel__h3">{t.panel.belligerents}</h3>
            {sides.map((s, i) =>
              s.members?.length ? (
                <div className="panel__belligerent" key={s.name}>
                  <div className="panel__belligerent-name">{localizedSide(conflict, i, locale)}</div>
                  <div className="panel__belligerent-members">{localizedMembers(conflict, i, locale).join(' · ')}</div>
                </div>
              ) : null,
            )}
          </section>
        )}

        <section className="panel__section">
          <h3 className="panel__h3">{t.panel.sources}</h3>
          <ul className="panel__sources">
            {conflict.sources.map((src) => (
              <li key={src.title}>
                {src.url ? (
                  <a href={src.url} target="_blank" rel="noopener noreferrer">
                    {src.title}
                  </a>
                ) : (
                  src.title
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}

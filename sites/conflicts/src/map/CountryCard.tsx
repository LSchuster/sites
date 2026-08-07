import { useEffect } from 'react';
import { useAtlas, setState, displayYear } from '../state/store.ts';
import { involvementOf } from '../data/involvement.ts';
import { politicalName, useBorderNames } from '../data/borderNames.ts';
import { localized } from '../data/conflicts.ts';
import { useLocale, useT } from '../i18n/index.ts';
import { formatDeaths } from '../i18n/format.ts';
import { SIDE } from '../theme.ts';
import { Flag } from '../ui/Flag.tsx';
import type { Conflict } from '../types.ts';

/**
 * What is happening to the country under the cursor.
 *
 * Two lists, deliberately kept apart. "Fighting in" means the conflict record names
 * this polity as a belligerent — matched by name, which is a heuristic across two
 * thousand years of shifting state names. "In the theatre" means only that the
 * country falls inside the conflict's geographic extent, which answers the question
 * "who else was in the way" without claiming they took part.
 */
export function CountryCard(): React.JSX.Element | null {
  const hovered = useAtlas((s) => s.hoveredCountry);
  const selected = useAtlas((s) => s.selectedCountry);
  const year = useAtlas((s) => displayYear(s.year));
  const t = useT();
  const locale = useLocale();
  useBorderNames(locale);

  const pinned = selected?.name != null;
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState({ selectedCountry: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinned]);

  // A clicked territory pins the card; otherwise it follows the cursor.
  const country = pinned ? selected : hovered;
  if (!country?.name) return null;

  // Involvement matching and the flag index join on the English name; only the
  // displayed strings are localized.
  const { named, nearby } = involvementOf(country.name, country.at, year);

  return (
    <aside className={`country${pinned ? ' country--pinned' : ''}`} aria-live="polite">
      <div className="country__head">
        <div className="country__identity">
          <Flag name={country.name} title={t.country.modernFlag} />
          <h3 className="country__name">{politicalName(country.name, locale)}</h3>
        </div>
        {pinned ? (
          <button
            className="country__close"
            onClick={() => setState({ selectedCountry: null })}
            aria-label={t.panel.close}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        ) : (
          <span className="country__year">{year}</span>
        )}
      </div>
      {country.subjectTo && (
        <div className="country__subject">
          {t.country.subjectTo} {politicalName(country.subjectTo, locale)}
        </div>
      )}

      {named.length > 0 && (
        <div className="country__group">
          <div className="country__label country__label--named">{t.country.fightingIn}</div>
          {named.slice(0, 4).map((c) => (
            <Row key={c.id} conflict={c} tone="named" />
          ))}
        </div>
      )}

      {nearby.length > 0 && (
        <div className="country__group">
          <div className="country__label">{t.country.inTheatre}</div>
          {nearby.slice(0, 3).map((c) => (
            <Row key={c.id} conflict={c} tone="nearby" />
          ))}
        </div>
      )}

      {named.length === 0 && nearby.length === 0 && <p className="country__none">{t.country.none}</p>}
    </aside>
  );
}

function Row({ conflict, tone }: { conflict: Conflict; tone: 'named' | 'nearby' }): React.JSX.Element {
  const t = useT();
  const locale = useLocale();
  return (
    <button
      className={`country__row country__row--${tone}`}
      onClick={() => setState({ selectedId: conflict.id })}
    >
      <span
        className="country__dot"
        style={{ background: tone === 'named' ? SIDE.b : SIDE.civilian }}
        aria-hidden="true"
      />
      <span className="country__row-name">{localized(conflict, locale).name}</span>
      <span className="country__row-deaths">{formatDeaths(conflict.total.best, t)}</span>
    </button>
  );
}

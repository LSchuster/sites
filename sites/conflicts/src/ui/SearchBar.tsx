import { useMemo, useState } from 'react';
import { localized, search, useConflictsLoaded } from '../data/conflicts.ts';
import { setState, useAtlas } from '../state/store.ts';
import { useLocale, useT } from '../i18n/index.ts';
import { formatDeaths, formatYears } from '../i18n/format.ts';
import type { ConflictType } from '../types.ts';

const TYPES: ConflictType[] = [
  'interstate',
  'civil',
  'colonial',
  'religious',
  'genocide',
  'rebellion',
  'invasion',
];

export function SearchBar(): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const typeFilter = useAtlas((s) => s.typeFilter);
  const t = useT();
  const locale = useLocale();
  useConflictsLoaded();

  const results = useMemo(() => search(query, locale), [query, locale]);

  const toggleType = (type: ConflictType) => {
    const next = new Set(typeFilter ?? TYPES);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    // All selected is the same as no filter — keep the state canonical so the
    // renderer's fast path (`!typeFilter`) stays hit.
    setState({ typeFilter: next.size === TYPES.length || next.size === 0 ? null : next });
  };

  return (
    <div className="tools">
      <div className="tools__search">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          placeholder={t.search.placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          aria-label={t.search.label}
        />
      </div>

      {/* Whitespace-only queries return [] from search() and must not show
          "no results" — hence the trim guard. */}
      {open && results.length === 0 && query.trim().length > 0 && (
        <ul className="tools__results">
          <li className="tools__results-empty">{t.search.noResults}</li>
        </ul>
      )}

      {open && results.length > 0 && (
        <ul className="tools__results">
          {results.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => {
                  // Jump the timeline into the conflict so it is actually on screen.
                  setState({
                    year: Math.round((c.startYear + c.endYear) / 2),
                    selectedId: c.id,
                    playing: false,
                  });
                  setQuery('');
                  setOpen(false);
                }}
              >
                <span className="tools__result-name">{localized(c, locale).name}</span>
                <span className="tools__result-meta">
                  {formatYears(c.startYear, c.endYear, t)} · {formatDeaths(c.total.best, t)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="tools__types" role="group" aria-label={t.search.filterByType}>
        {TYPES.map((type) => {
          const active = !typeFilter || typeFilter.has(type);
          return (
            <button
              key={type}
              className={`tools__type${active ? ' is-active' : ''}`}
              onClick={() => toggleType(type)}
              aria-pressed={active}
            >
              {t.types[type]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

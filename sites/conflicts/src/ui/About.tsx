import { useEffect } from 'react';
import { useT } from '../i18n/index.ts';

/**
 * Entirely driven by the active locale — headings, prose and source blurbs all come
 * from the dictionary, so a new language translates this page without touching the
 * component.
 */
export function About({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="about" role="dialog" aria-modal="true" aria-label={t.about.title}>
      <div className="about__backdrop" onClick={onClose} />
      <div className="about__panel">
        <button className="about__close" onClick={onClose} aria-label={t.panel.close}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <div className="about__scroll">
          <h2 className="about__title">{t.about.title}</h2>
          <p className="about__lede">{t.about.lede}</p>

          {t.about.sections.map((section) => (
            <section key={section.heading}>
              <h3 className="about__h3">{section.heading}</h3>
              {section.paragraphs.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </section>
          ))}

          <h3 className="about__h3">{t.about.sourcesHeading}</h3>
          <ul className="about__sources">
            {t.about.sources.map((s) => (
              <li key={s.name}>
                <div className="about__source-head">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.name}
                    </a>
                  ) : (
                    <span>{s.name}</span>
                  )}
                  <span className="about__source-span">{s.span}</span>
                </div>
                <p className="about__source-detail">{s.detail}</p>
              </li>
            ))}
          </ul>

          <p className="about__foot">{t.about.footnote}</p>
        </div>
      </div>
    </div>
  );
}

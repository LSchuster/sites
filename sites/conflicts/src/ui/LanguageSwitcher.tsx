import { LOCALES, LOCALE_CODES, setLocale, useLocale, useT } from '../i18n/index.ts';

/**
 * Language chooser.
 *
 * Rendered as a segmented control rather than a `<select>` because there are two
 * languages today and the list is meant to stay short; each option is labelled with
 * its own endonym ("Deutsch", not "German"), which is the convention that lets a
 * reader find their language without already reading the interface language.
 */
export function LanguageSwitcher(): React.JSX.Element {
  const locale = useLocale();
  const t = useT();

  return (
    <div className="lang" role="group" aria-label={t.app.language}>
      {LOCALE_CODES.map((code) => (
        <button
          key={code}
          className={`lang__option${code === locale ? ' is-active' : ''}`}
          onClick={() => setLocale(code)}
          aria-pressed={code === locale}
          lang={LOCALES[code].bcp47}
          title={LOCALES[code].localeName}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

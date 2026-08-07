import { MONETIZATION } from '../config';
import { t } from '../i18n';

export function Footer() {
  return (
    <footer className="site-footer">
      <p>
        {t.footerPrivacy} · {t.footerDisclaimer}
      </p>
      <p>
        <a href="./impressum.html">Impressum</a> · <a href="./datenschutz.html">Datenschutz</a>
        {MONETIZATION.donationEnabled && MONETIZATION.donationUrl ? (
          <>
            {' · '}
            <a href={MONETIZATION.donationUrl} target="_blank" rel="noopener">
              Unterstützen ♥
            </a>
          </>
        ) : null}
      </p>
    </footer>
  );
}

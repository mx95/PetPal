import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

const SOCIAL_LINKS = [
  {
    id: 'instagram',
    href: 'https://www.instagram.com/petpalcarehub',
    labelKey: 'footer.instagram',
  },
  {
    id: 'facebook',
    href: 'https://www.facebook.com/profile.php?id=61591283802491',
    labelKey: 'footer.facebook',
  },
  {
    id: 'tiktok',
    href: 'https://www.tiktok.com/@petpal.care.hub',
    labelKey: 'footer.tiktok',
  },
];

function SocialGlyph({ id }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false };
  if (id === 'facebook') {
    return (
      <svg {...common}>
        <path
          fill="currentColor"
          d="M14 8h2.5V4.8C16.1 4.5 15 4.3 13.8 4.3 11.3 4.3 9.6 5.9 9.6 8.8V11H7v3.5h2.6V20h3.4v-5.5H16L16.6 11h-3.6V9c0-1 .3-1.7 1.4-1.7Z"
        />
      </svg>
    );
  }
  if (id === 'tiktok') {
    return (
      <svg {...common}>
        <path
          fill="currentColor"
          d="M19.1 8.4c-1.5-.1-2.9-.7-4-1.6v7.2a5.2 5.2 0 1 1-5.2-5.2c.3 0 .6 0 .9.1v2.6a2.6 2.6 0 1 0 1.8 2.5V2.8h2.5c.2 2.2 1.8 4 3.9 4.4v1.2Z"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        fill="currentColor"
        d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2Zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2Zm6.3-8.2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM12 2.5c-2.4 0-2.7 0-3.7.1-2.5.1-3.7 1.3-3.8 3.8-.1 1-.1 1.3-.1 3.7s0 2.7.1 3.7c.1 2.5 1.3 3.7 3.8 3.8 1 .1 1.3.1 3.7.1s2.7 0 3.7-.1c2.5-.1 3.7-1.3 3.8-3.8.1-1 .1-1.3.1-3.7s0-2.7-.1-3.7c-.1-2.5-1.3-3.7-3.8-3.8-1-.1-1.3-.1-3.7-.1Zm0 1.5c2.3 0 2.6 0 3.5.1 1.8.1 2.6.9 2.7 2.7.1.9.1 1.2.1 3.5s0 2.6-.1 3.5c-.1 1.8-.9 2.6-2.7 2.7-.9.1-1.2.1-3.5.1s-2.6 0-3.5-.1c-1.8-.1-2.6-.9-2.7-2.7-.1-.9-.1-1.2-.1-3.5s0-2.6.1-3.5c.1-1.8.9-2.6 2.7-2.7.9-.1 1.2-.1 3.5-.1Z"
      />
    </svg>
  );
}

export function AppFooter() {
  const { t } = useI18n();
  const reopenCookieSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent('petpal:open-cookie-settings'));
  }, []);

  return (
    <footer className="pp-footer" role="contentinfo">
      <div className="pp-footer__inner">
        <div className="pp-footer__grid pp-footer__grid--brandOnly">
          <section className="pp-footer__col pp-footer__col--brand" aria-label="PetPal">
            <h3 className="pp-footer__brand">PetPal</h3>
            <p className="pp-footer__desc">{t('footer.brandDesc')}</p>
            <nav className="pp-footer__social" aria-label={t('footer.socialNav')}>
              {SOCIAL_LINKS.map(({ id, href, labelKey }) => (
                <a
                  key={id}
                  className="pp-footer__socialLink"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t(labelKey)}
                  title={t(labelKey)}
                >
                  <SocialGlyph id={id} />
                  <span>{t(labelKey)}</span>
                </a>
              ))}
            </nav>
          </section>
        </div>

        <p className="pp-footer__note">
          © {new Date().getFullYear()} PetPal. {t('footer.rightsAndByline')}
          {' · '}
          <Link className="pp-footer__inlineLink" to="/privacy">
            {t('footer.privacyPolicy')}
          </Link>
          {' · '}
          <Link className="pp-footer__inlineLink" to="/terms">
            {t('footer.terms')}
          </Link>
          {' · '}
          <button type="button" className="pp-footer__inlineLink pp-footer__linkBtn" onClick={reopenCookieSettings}>
            {t('footer.cookieSettings')}
          </button>
        </p>
      </div>
    </footer>
  );
}

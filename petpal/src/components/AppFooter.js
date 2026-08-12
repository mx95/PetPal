import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

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

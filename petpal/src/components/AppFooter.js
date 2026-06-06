import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MVP_NAV } from '../config/mvpNav';
import { useI18n } from '../i18n/I18nContext';

export function AppFooter() {
  const { t } = useI18n();
  const reopenCookieSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent('petpal:open-cookie-settings'));
  }, []);

  return (
    <footer className="pp-footer" role="contentinfo">
      <div className="pp-footer__inner">
        <div className="pp-footer__grid">
          <section className="pp-footer__col pp-footer__col--brand" aria-label="PetPal">
            <h3 className="pp-footer__brand">PetPal</h3>
            <p className="pp-footer__desc">{t('footer.brandDesc')}</p>
          </section>

          <nav className="pp-footer__col" aria-label={t('footer.company')}>
            <h4 className="pp-footer__title">{t('footer.company')}</h4>
            <Link className="pp-footer__link" to="/docs">
              {t('footer.about')}
            </Link>
            {MVP_NAV.showShop ? (
              <Link className="pp-footer__link" to="/shop">
                {t('footer.pricing')}
              </Link>
            ) : (
              <Link className="pp-footer__link" to="/docs">
                {t('nav.docs')}
              </Link>
            )}
            <Link className="pp-footer__link" to="/contact">
              {t('footer.contact')}
            </Link>
          </nav>

          <nav className="pp-footer__col" aria-label={t('footer.legal')}>
            <h4 className="pp-footer__title">{t('footer.legal')}</h4>
            <Link className="pp-footer__link" to="/privacy">
              {t('footer.privacyPolicy')}
            </Link>
            <Link className="pp-footer__link" to="/terms">
              {t('footer.terms')}
            </Link>
            <button type="button" className="pp-footer__link pp-footer__linkBtn" onClick={reopenCookieSettings}>
              {t('footer.cookieSettings')}
            </button>
          </nav>
        </div>

        <p className="pp-footer__note">
          © {new Date().getFullYear()} PetPal. {t('footer.rightsAndByline')}
        </p>
      </div>
    </footer>
  );
}

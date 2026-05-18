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

          <nav className="pp-footer__col" aria-label="Company">
            <h4 className="pp-footer__title">Company</h4>
            <Link className="pp-footer__link" to="/docs">
              About us
            </Link>
            {MVP_NAV.showShop ? (
              <Link className="pp-footer__link" to="/shop">
                Pricing
              </Link>
            ) : (
              <Link className="pp-footer__link" to="/docs">
                {t('nav.docs')}
              </Link>
            )}
            <a className="pp-footer__link" href="mailto:support@petpal.app">
              Contact us
            </a>
          </nav>

          <nav className="pp-footer__col" aria-label="Legal">
            <h4 className="pp-footer__title">Legal</h4>
            <Link className="pp-footer__link" to="/privacy">
              Privacy Policy
            </Link>
            <Link className="pp-footer__link" to="/terms">
              Terms &amp; Conditions
            </Link>
            <button type="button" className="pp-footer__link pp-footer__linkBtn" onClick={reopenCookieSettings}>
              Cookie settings
            </button>
          </nav>
        </div>

        <p className="pp-footer__note">© {new Date().getFullYear()} PetPal. {t('footer.rightsAndByline')}</p>
      </div>
    </footer>
  );
}

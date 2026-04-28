import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { clearCookieConsent } from '../cookies/cookieConsentStorage';

export function AppFooter() {
  const reopenCookieSettings = useCallback(() => {
    clearCookieConsent();
    window.location.reload();
  }, []);

  return (
    <footer className="pp-footer" role="contentinfo">
      <div className="pp-footer__inner">
        <span className="pp-footer__brand">PetPal</span>
        <nav className="pp-footer__nav" aria-label="Legal">
          <Link className="pp-footer__link" to="/privacy">
            Privacy
          </Link>
          <Link className="pp-footer__link" to="/terms">
            Terms
          </Link>
          <Link className="pp-footer__link" to="/cookies">
            Cookies
          </Link>
          <button type="button" className="pp-footer__link" onClick={reopenCookieSettings} style={{ border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}>
            Cookie settings
          </button>
        </nav>
        <p className="pp-footer__note">EU/EEA: information provided for transparency. Replace placeholders in legal pages with your entity details.</p>
      </div>
    </footer>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCookieConsent, setCookieConsent } from '../cookies/cookieConsentStorage';
import { enableFirebaseAnalytics, isFirebaseAnalyticsConfigured } from '../firebase';

/**
 * First-visit cookie consent: necessary storage always; optional Google Analytics only after opt-in.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const withAnalytics = isFirebaseAnalyticsConfigured();

  const applyAll = useCallback(() => {
    setCookieConsent('all');
    setVisible(false);
    enableFirebaseAnalytics().catch(() => {});
  }, []);

  const applyNecessary = useCallback(() => {
    setCookieConsent('necessary');
    setVisible(false);
  }, []);

  useEffect(() => {
    const c = getCookieConsent();
    if (c.status === 'all') {
      enableFirebaseAnalytics().catch(() => {});
      setVisible(false);
      return;
    }
    if (c.status === 'necessary') {
      setVisible(false);
      return;
    }
    // pending
    setVisible(true);
  }, []);

  if (!visible) return null;

  if (!withAnalytics) {
    return (
      <div className="pp-cookieBanner" role="dialog" aria-labelledby="cookie-banner-title" aria-modal="false">
        <div className="pp-cookieBanner__text">
          <h2 id="cookie-banner-title" className="pp-cookieBanner__title">
            Cookies and storage
          </h2>
          <p>
            PetPal uses essential browser storage and session data so you can sign in and use the app. We do not load
            Google Analytics in this build. See the{' '}
            <Link to="/cookies" className="pp-link" style={{ display: 'inline', padding: 0 }}>
              Cookie policy
            </Link>
            .
          </p>
        </div>
        <div className="pp-cookieBanner__actions">
          <button type="button" className="pp-btn pp-btnPrimary" onClick={applyNecessary}>
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pp-cookieBanner" role="dialog" aria-labelledby="cookie-banner-title-ga" aria-modal="false">
      <div className="pp-cookieBanner__text">
        <h2 id="cookie-banner-title-ga" className="pp-cookieBanner__title">
          We value your privacy
        </h2>
        <p>
          We use essential cookies and storage for login and the app. With your permission we also use Google Analytics
          to understand how the app is used in aggregate. See our{' '}
          <Link to="/cookies" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            Cookie
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            Privacy
          </Link>{' '}
          pages.
        </p>
      </div>
      <div className="pp-cookieBanner__actions">
        <button type="button" className="pp-btn" onClick={applyNecessary}>
          Essential only
        </button>
        <button type="button" className="pp-btn pp-btnPrimary" onClick={applyAll}>
          Accept analytics
        </button>
      </div>
    </div>
  );
}

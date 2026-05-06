import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCookieConsent, setCookieConsent } from '../cookies/cookieConsentStorage';
import { enableFirebaseAnalytics, isFirebaseAnalyticsConfigured } from '../firebase';
import { useI18n } from '../i18n/I18nContext';

/**
 * First-visit cookie consent: necessary storage always; optional Google Analytics only after opt-in.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [statisticsEnabled, setStatisticsEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [openInfo, setOpenInfo] = useState({
    functional: false,
    statistics: false,
    marketing: false,
  });
  const withAnalytics = isFirebaseAnalyticsConfigured();
  const { t } = useI18n();

  useEffect(() => {
    const handleOpenCookieSettings = () => {
      setVisible(true);
    };

    window.addEventListener('petpal:open-cookie-settings', handleOpenCookieSettings);
    return () => {
      window.removeEventListener('petpal:open-cookie-settings', handleOpenCookieSettings);
    };
  }, []);

  const applyAll = useCallback(() => {
    setCookieConsent('all');
    setVisible(false);
    enableFirebaseAnalytics().catch(() => {});
  }, []);

  const savePreferences = useCallback(() => {
    if (withAnalytics && statisticsEnabled) {
      setCookieConsent('all');
      enableFirebaseAnalytics().catch(() => {});
    } else {
      setCookieConsent('necessary');
    }
    setVisible(false);
    setShowCustomize(false);
  }, [statisticsEnabled, withAnalytics]);

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
    setShowCustomize(false);
    setStatisticsEnabled(false);
    setMarketingEnabled(false);
    setOpenInfo({ functional: false, statistics: false, marketing: false });
  }, []);

  if (!visible) return null;

  return (
    <div className="pp-cookieBanner" role="dialog" aria-labelledby="cookie-banner-title-ga" aria-modal="false">
      <div className="pp-cookieBanner__text">
        <h2 id="cookie-banner-title-ga" className="pp-cookieBanner__title">
          Manage Consent 🍪
        </h2>
        <p>{withAnalytics ? t('cookie.bodyGA') : t('cookie.bodyNoGA')}</p>
      </div>
      <div className="pp-cookieBanner__actions">
        <button type="button" className="pp-btn pp-btnPrimary" onClick={applyAll}>
          {t('cookie.acceptAll')}
        </button>
        <button
          type="button"
          className="pp-btn"
          onClick={() => setShowCustomize((prev) => !prev)}
          aria-expanded={showCustomize}
        >
          {showCustomize ? 'Close customization' : 'Customize'}
        </button>
      </div>

      {showCustomize ? (
        <div className="pp-cookieBanner__customize">
          <div className="pp-cookieBanner__optGroup pp-cookieBanner__optGroup--disabled">
            <div className="pp-cookieBanner__optHead">
              <label className="pp-cookieBanner__opt">
                <input type="checkbox" checked disabled />
                <span>
                  <strong>Functional</strong>
                </span>
              </label>
              <button
                type="button"
                className="pp-cookieBanner__optToggle"
                aria-expanded={openInfo.functional}
                onClick={() => setOpenInfo((prev) => ({ ...prev, functional: !prev.functional }))}
              >
                <span className={`pp-cookieBanner__optChevron ${openInfo.functional ? 'is-open' : ''}`} aria-hidden>
                  ▾
                </span>
              </button>
            </div>
            {openInfo.functional ? (
              <p className="pp-cookieBanner__optDesc">
                The technical storage or access is strictly necessary for the legitimate purpose of enabling
                the use of a specific service explicitly requested by the subscriber or user, or for the sole
                purpose of carrying out the transmission of a communication over an electronic communications
                network.
              </p>
            ) : null}
          </div>

          <div className="pp-cookieBanner__optGroup">
            <div className="pp-cookieBanner__optHead">
              <label className="pp-cookieBanner__opt">
                <input
                  type="checkbox"
                  checked={statisticsEnabled}
                  onChange={(e) => setStatisticsEnabled(e.target.checked)}
                />
                <span>
                  <strong>Statistics</strong>
                </span>
              </label>
              <button
                type="button"
                className="pp-cookieBanner__optToggle"
                aria-expanded={openInfo.statistics}
                onClick={() => setOpenInfo((prev) => ({ ...prev, statistics: !prev.statistics }))}
              >
                <span className={`pp-cookieBanner__optChevron ${openInfo.statistics ? 'is-open' : ''}`} aria-hidden>
                  ▾
                </span>
              </button>
            </div>
            {openInfo.statistics ? (
              <p className="pp-cookieBanner__optDesc">
                The technical storage or access that is used exclusively for statistical purposes.
              </p>
            ) : null}
          </div>

          <div className="pp-cookieBanner__optGroup">
            <div className="pp-cookieBanner__optHead">
              <label className="pp-cookieBanner__opt">
                <input
                  type="checkbox"
                  checked={marketingEnabled}
                  onChange={(e) => setMarketingEnabled(e.target.checked)}
                />
                <span>
                  <strong>Marketing</strong>
                </span>
              </label>
              <button
                type="button"
                className="pp-cookieBanner__optToggle"
                aria-expanded={openInfo.marketing}
                onClick={() => setOpenInfo((prev) => ({ ...prev, marketing: !prev.marketing }))}
              >
                <span className={`pp-cookieBanner__optChevron ${openInfo.marketing ? 'is-open' : ''}`} aria-hidden>
                  ▾
                </span>
              </button>
            </div>
            {openInfo.marketing ? (
              <p className="pp-cookieBanner__optDesc">
                The technical storage or access is required to create user profiles to send advertising, or to
                track the user on a website or across several websites for similar marketing purposes.
              </p>
            ) : null}
          </div>

          <button type="button" className="pp-btn pp-btnPrimary" onClick={savePreferences}>
            Save preferences
          </button>
        </div>
      ) : null}

      <div className="pp-cookieBanner__links">
        <Link to="/cookies" className="pp-link">{t('footer.cookies')}</Link>
        <span aria-hidden>·</span>
        <Link to="/privacy" className="pp-link">{t('footer.privacy')}</Link>
      </div>
    </div>
  );
}

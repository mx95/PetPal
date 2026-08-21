import React, { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { MVP_NAV } from '../config/mvpNav';
import { useI18n } from '../i18n/I18nContext';

const IMG_BASE = `${process.env.PUBLIC_URL || ''}/images`;
const HOME_HERO_WEBP = `${IMG_BASE}/home-hero.webp`;
const HOME_HERO_JPG = `${IMG_BASE}/home-hero.jpg`;
const LIVE_TRACKING_WEBP = `${IMG_BASE}/home-live-tracking.webp`;
const LIVE_TRACKING_JPG = `${IMG_BASE}/home-live-tracking.jpg`;
const NFC_FEATURE_WEBP = `${IMG_BASE}/home-nfc-feature.webp`;
const NFC_FEATURE_JPG = `${IMG_BASE}/home-nfc-feature.jpg`;

const APP_CAPABILITIES = [
  { key: 'gps', to: '/tracking', accent: 'gps' },
  { key: 'nfc', to: '/shop', accent: 'nfc', mvp: MVP_NAV.showShop },
  { key: 'nearby', to: '/nearby', accent: 'nearby' },
  { key: 'booking', to: '/bookings', accent: 'booking', mvp: MVP_NAV.showBookings },
  { key: 'shop', to: '/shop', accent: 'shop', mvp: MVP_NAV.showShop },
  { key: 'achievements', to: '/dashboard', accent: 'achievements' },
].filter((item) => item.mvp !== false);

const SHOWCASE_ITEMS = [
  { key: 'live', webp: LIVE_TRACKING_WEBP, jpg: LIVE_TRACKING_JPG, altKey: 'home.welcome.showcase.liveAlt' },
  { key: 'nfc', webp: NFC_FEATURE_WEBP, jpg: NFC_FEATURE_JPG, altKey: 'home.welcome.showcase.nfcAlt' },
];

function CapabilityIcon({ type }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (type === 'gps') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      </svg>
    );
  }
  if (type === 'nfc') {
    return (
      <svg {...common}>
        <rect x="4" y="3.5" width="16" height="17" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 9.5c1.2-1.1 4.8-1.1 6 0M9.8 12.2c.8-.7 3.4-.7 4.2 0M11 14.8c.4-.35 1.6-.35 2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="17.6" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (type === 'nearby') {
    return (
      <svg {...common}>
        <path
          d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 12 4.3a6.5 6.5 0 0 0-6.5 6.5C5.5 15.8 12 21 12 21Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10.8" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (type === 'booking') {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3.5V7M16 3.5V7M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="7.5" y="13" width="3" height="3" rx="0.6" fill="currentColor" />
        <rect x="13.5" y="13" width="3" height="3" rx="0.6" fill="currentColor" opacity="0.45" />
      </svg>
    );
  }
  if (type === 'achievements') {
    return (
      <svg {...common}>
        <circle cx="12" cy="9" r="4.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 13.2V17M9.2 20l2.8-3 2.8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.2 7.2 5.5 5.8M15.8 7.2l2.7-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M7.5 8.5h9l1.2 9.2a1.8 1.8 0 0 1-1.8 2H8.1a1.8 1.8 0 0 1-1.8-2L7.5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function HomeScreen() {
  const { t } = useI18n();
  const { user } = useAuth();

  useEffect(() => {
    if (user) return undefined;
    const prefetch = () => {
      import(/* webpackChunkName: "login" */ './Login');
      import(/* webpackChunkName: "register" */ './Register');
    };
    if (typeof window === 'undefined') return undefined;
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(prefetch, { timeout: 2500 })
      : window.setTimeout(prefetch, 1200);
    return () => {
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(idle);
      }
      window.clearTimeout(idle);
    };
  }, [user]);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="pp-homeWelcome">
      <section className="pp-homeWelcome__banner" aria-labelledby="home-hero-title">
        <div className="pp-homeWelcome__bannerArt" aria-hidden>
          <picture>
            <source srcSet={HOME_HERO_WEBP} type="image/webp" />
            <img
              className="pp-homeWelcome__heroImg"
              src={HOME_HERO_JPG}
              alt={t('home.welcome.heroImageAlt')}
              width={1200}
              height={800}
              decoding="async"
              fetchPriority="high"
            />
          </picture>
          <div className="pp-homeWelcome__heroFade" />
        </div>
        <div className="pp-homeWelcome__bannerOverlay">
          <div className="pp-homeWelcome__bannerCopy">
            <div className="pp-homeWelcome__bannerGreeting">
              <p className="pp-homeWelcome__eyebrow">{t('home.publicHero.eyebrow')}</p>
              <h1 id="home-hero-title" className="pp-homeWelcome__title">
                {t('home.publicHero.headline')}
              </h1>
            </div>
            <div className="pp-homeWelcome__bannerBody">
              <p className="pp-homeWelcome__lead">{t('home.publicHero.sub')}</p>
            </div>
          </div>
        </div>
        <div className="pp-homeWelcome__bannerActions">
          <div className="pp-homeWelcome__ctaRow">
            <Link className="pp-btn pp-btnPrimary" to="/register">
              {t('home.publicHero.ctaPrimary')}
            </Link>
            <Link className="pp-btn pp-btn--ghost" to="/login">
              {t('home.publicHero.ctaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      <ul className="pp-homeWelcome__capabilities" role="list">
        {APP_CAPABILITIES.map(({ key, to, accent }) => (
          <li key={key}>
            <Link to={to} className={`pp-homeWelcome__capability pp-homeWelcome__capability--${accent}`}>
              <span className="pp-homeWelcome__capabilityIcon" aria-hidden>
                <CapabilityIcon type={accent} />
              </span>
              <strong>{t(`home.welcome.capability.${key}.title`)}</strong>
              <span>{t(`home.welcome.capability.${key}.desc`)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="pp-homeWelcome__showcase" aria-labelledby="home-showcase-title">
        <header className="pp-homeWelcome__showcaseHead">
          <p className="pp-homeWelcome__showcaseEyebrow">{t('home.welcome.showcase.eyebrow')}</p>
          <h2 id="home-showcase-title" className="pp-homeWelcome__showcaseTitle">
            {t('home.welcome.showcase.title')}
          </h2>
        </header>
        <div className="pp-homeWelcome__showcaseGrid">
          {SHOWCASE_ITEMS.map(({ key, webp, jpg, altKey }) => (
            <figure key={key} className="pp-homeWelcome__showcaseCard">
              <picture>
                <source srcSet={webp} type="image/webp" />
                <img src={jpg} alt={t(altKey)} loading="lazy" decoding="async" width={1200} height={800} />
              </picture>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}

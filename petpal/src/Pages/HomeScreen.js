import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { MVP_NAV } from '../config/mvpNav';
import { useI18n } from '../i18n/I18nContext';

const HOME_HERO_SRC = `${process.env.PUBLIC_URL || ''}/images/home-hero.png`;

const ALL_FEATURES = [
  { key: 'pets', to: '/pets', icon: '🐾', accent: 'pets' },
  { key: 'track', to: '/tracking', icon: '📍', accent: 'tracking' },
  { key: 'activity', to: '/dashboard', icon: '🚶', accent: 'dashboard', mvp: MVP_NAV.showDashboard },
  { key: 'nearby', to: '/nearby', icon: '🗺️', accent: 'nearby' },
  { key: 'book', to: '/bookings', icon: '📅', accent: 'bookings', mvp: MVP_NAV.showBookings },
  { key: 'community', to: '/community', icon: '💬', accent: 'community', mvp: MVP_NAV.showCommunity },
];

const FEATURES = ALL_FEATURES.filter((f) => f.mvp !== false);

const VALUE_PILLARS = [
  { key: 'value1', icon: 'shield' },
  { key: 'value2', icon: 'heart' },
  { key: 'value3', icon: 'globe' },
];

function ValuePillarIcon({ type }) {
  if (type === 'heart') {
    return (
      <svg className="pp-homeWelcome__heartIcon" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path
          fill="currentColor"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
    );
  }
  if (type === 'shield') return '🛡️';
  return '🌍';
}

function displayName(user) {
  const n = String(user?.displayName || '').trim();
  if (n) return n.split(' ')[0];
  const email = String(user?.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return null;
}

export default function HomeScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const firstName = displayName(user);

  return (
    <div className="pp-homeWelcome">
      <section className="pp-homeWelcome__banner" aria-labelledby="home-hero-title">
        <div className="pp-homeWelcome__bannerArt" aria-hidden>
          <img
            className="pp-homeWelcome__heroImg"
            src={HOME_HERO_SRC}
            alt={t('home.welcome.heroImageAlt')}
            decoding="async"
          />
          <div className="pp-homeWelcome__heroFade" />
        </div>
        <div className="pp-homeWelcome__bannerOverlay">
          <div className="pp-homeWelcome__bannerCopy">
            <div className="pp-homeWelcome__bannerGreeting">
              <p className="pp-homeWelcome__eyebrow">{t('home.welcome.eyebrow')}</p>
              <h1 id="home-hero-title" className="pp-homeWelcome__title">
                {user && firstName ? t('home.welcome.headlineNamed', { name: firstName }) : t('home.publicHero.headline')}
              </h1>
            </div>
            <div className="pp-homeWelcome__bannerBody">
              {user && firstName ? (
                <p className="pp-homeWelcome__headlineSub">{t('home.welcome.headlineSub')}</p>
              ) : null}
              <p className="pp-homeWelcome__lead">
                {user ? t('home.welcome.leadSignedIn') : t('home.publicHero.sub')}
              </p>
            </div>
          </div>
        </div>
        <div className="pp-homeWelcome__bannerActions">
          {!user ? (
            <div className="pp-homeWelcome__ctaRow">
              <Link className="pp-btn pp-btnPrimary" to="/register">
                {t('home.publicHero.ctaPrimary')}
              </Link>
              <Link className="pp-btn pp-btn--ghost" to="/login">
                {t('home.publicHero.ctaSecondary')}
              </Link>
            </div>
          ) : (
            <div className="pp-homeWelcome__ctaRow">
              <Link className="pp-btn pp-btnPrimary" to="/pets">
                {t('home.welcome.ctaPets')}
              </Link>
              <Link className="pp-btn pp-btn--ghost" to="/tracking">
                {t('home.welcome.ctaTrack')}
              </Link>
            </div>
          )}
          <p className="pp-homeWelcome__trust">{user ? t('home.welcome.stayLine') : t('home.publicHero.trustLine')}</p>
        </div>
      </section>

      <ul className="pp-homeWelcome__values" role="list">
        {VALUE_PILLARS.map(({ key, icon }) => (
          <li key={key} className="pp-homeWelcome__value">
            <span className={`pp-homeWelcome__valueIcon${icon === 'heart' ? ' pp-homeWelcome__valueIcon--heart' : ''}`} aria-hidden>
              <ValuePillarIcon type={icon} />
            </span>
            <div>
              <strong>{t(`home.welcome.${key}Title`)}</strong>
              <p>{t(`home.welcome.${key}Desc`)}</p>
            </div>
          </li>
        ))}
      </ul>

      <section className="pp-homeWelcome__section" aria-labelledby="home-features-title">
        <h2 id="home-features-title" className="pp-homeWelcome__sectionTitle">
          {t('home.welcome.featuresTitle')}
        </h2>
        <p className="pp-homeWelcome__sectionSub">{t('home.welcome.featuresSub')}</p>
        <ul className="pp-homeWelcome__features" role="list">
          {FEATURES.map(({ key, to, icon, accent }) => (
            <li key={key}>
              <Link to={to} className={`pp-homeWelcome__feature pp-homeWelcome__feature--${accent}`}>
                <span className="pp-homeWelcome__featureIcon" aria-hidden>
                  {icon}
                </span>
                <span className="pp-homeWelcome__featureBody">
                  <strong>{t(`home.welcome.feature.${key}.title`)}</strong>
                  <span>{t(`home.welcome.feature.${key}.desc`)}</span>
                </span>
                <span className="pp-homeWelcome__featureArrow" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

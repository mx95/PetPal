import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';

function GreyIcon({ children }) {
  return (
    <div className="pp-homeTile__iconWrap" aria-hidden>
      <svg className="pp-homeTile__iconSvg" viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
        {children}
      </svg>
    </div>
  );
}

const ICONS = {
  dashboard: (
    <>
      <rect x="4" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 14h16" stroke="currentColor" strokeWidth="1.25" opacity="0.6" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="10" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 21c1-3 16-3 17 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  pets: (
    <>
      <ellipse cx="9" cy="12" rx="3" ry="4" stroke="currentColor" strokeWidth="1.65" />
      <ellipse cx="15.5" cy="12.5" rx="2.5" ry="3" stroke="currentColor" strokeWidth="1.65" />
      <path d="M6 17c2 2 10 2 13 0" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </>
  ),
  premium: (
    <>
      <path
        d="M12 5l2 6h7l-5.5 4 2 6.5L12 18l-5.5 4 2-6.5L3 11h7l2-6z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
    </>
  ),
  community: (
    <>
      <path
        d="M8 17a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm8-10a4 4 0 1 1 0 8M8 21c0-4 10-4 16 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  ),
  leaderboard: (
    <>
      <rect x="4" y="14" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.65" />
      <rect x="9.5" y="9" width="5" height="11" rx="1" stroke="currentColor" strokeWidth="1.65" />
      <rect x="15" y="6" width="5" height="14" rx="1" stroke="currentColor" strokeWidth="1.65" />
    </>
  ),
  nearby: (
    <>
      <path
        d="M12 21s7-5.8 7-11a7 7 0 10-14 0c0 5.2 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  tracking: (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.65" opacity="0.45" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.65" opacity="0.75" />
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.35" stroke="none" />
    </>
  ),
  business: (
    <>
      <path d="M5 21V8l9-5 9 5v13" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M9 21v-8h11v8" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <circle cx="10" cy="12" r="1" fill="currentColor" opacity="0.65" stroke="none" />
    </>
  ),
  docs: (
    <>
      <path d="M7 21h14V8l-5.5-5H7v18z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M10 21V12h11" stroke="currentColor" strokeWidth="1.35" opacity="0.45" strokeLinecap="round" />
    </>
  ),
  admin: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.65" opacity="0.75" />
      <path d="M8 13h9M13 16h3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </>
  ),
};

export default function HomeScreen() {
  const { user } = useAuth();
  const { isAdmin } = useCompany();
  const { t } = useI18n();

  const baseTiles = [
    { iconKey: 'dashboard', titleKey: 'home.tileDashboard', to: '/dashboard', auth: true },
    { iconKey: 'profile', titleKey: 'home.tileProfile', to: '/profile', auth: true },
    { iconKey: 'pets', titleKey: 'home.tilePets', to: '/pets', auth: true },
    { iconKey: 'premium', titleKey: 'home.tilePremium', to: '/premium/lost', auth: true },
    { iconKey: 'community', titleKey: 'home.tileCommunity', to: '/community', auth: true },
    { iconKey: 'leaderboard', titleKey: 'home.tileLeaderboard', to: '/leaderboard', auth: true },
    { iconKey: 'nearby', titleKey: 'home.tileNearby', to: '/nearby', auth: true },
    { iconKey: 'tracking', titleKey: 'home.tileTracking', to: '/tracking', auth: true },
    { iconKey: 'business', titleKey: 'home.tileBusiness', to: '/company/apply', auth: true },
    { iconKey: 'docs', titleKey: 'home.tileDocs', to: '/docs', auth: false },
  ];

  const tiles = [
    ...baseTiles.map((x) => ({ iconKey: x.iconKey, title: t(x.titleKey), to: x.to, auth: x.auth })),
    ...(isAdmin && user ? [{ iconKey: 'admin', title: t('home.tileAdmin'), to: '/admin/company-approvals', auth: true }] : []),
  ];

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad" style={{ maxWidth: 960, margin: '0 auto' }}>
          <div className="pp-badge">{t('home.badge')}</div>
          <h1 className="pp-h1" style={{ marginTop: 10 }}>
            {t('home.title')}
          </h1>
          <p className="pp-subtle" style={{ marginTop: 6, marginBottom: 22, maxWidth: 640 }}>
            {t('home.subtitle')}
          </p>

          <div className="pp-homeGrid">
            {tiles.map(({ iconKey, title, to, auth: authReq }) => {
              const locked = Boolean(authReq) && !user;
              const body = (
                <>
                  <GreyIcon>{ICONS[iconKey]}</GreyIcon>
                  <span className="pp-homeTile__title">{title}</span>
                  {locked ? <span className="pp-homeTile__hint">{t('home.signInToOpen')}</span> : null}
                </>
              );
              const cls = ['pp-homeTile'];
              if (locked) cls.push('pp-homeTile--locked');

              if (locked) {
                return (
                  <Link key={`${iconKey}-${to}`} className={cls.join(' ')} to="/login" state={{ from: to }} aria-label={`${title}. ${t('home.signInToOpen')}`}>
                    {body}
                  </Link>
                );
              }
              return (
                <Link key={`${iconKey}-${to}`} className={cls.join(' ')} to={to} aria-label={title}>
                  <GreyIcon>{ICONS[iconKey]}</GreyIcon>
                  <span className="pp-homeTile__title">{title}</span>
                </Link>
              );
            })}
          </div>

          {!user ? (
            <p className="pp-subtle" style={{ marginTop: 22 }}>
              <Link className="pp-link" to="/login">
                {t('nav.login')}
              </Link>
              {' · '}
              <Link className="pp-link" to="/register">
                {t('nav.register')}
              </Link>
              {' · '}
              <Link className="pp-link" to="/docs">
                {t('home.tileDocs')}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

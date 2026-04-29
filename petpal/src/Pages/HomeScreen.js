import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';

function GreyIcon({ children, premium }) {
  return (
    <div
      className={['pp-homeTile__iconWrap', premium ? 'pp-homeTile__iconWrap--premium' : ''].filter(Boolean).join(' ')}
      aria-hidden
    >
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

/** Icons shown only inside the Premium section */
const ICONS_PREMIUM = {
  lost: (
    <>
      <path d="M12 3 L20 17 H4 L12 3 Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M12 9v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="14.5" r="0.9" fill="currentColor" />
    </>
  ),
  stray: (
    <>
      <ellipse cx="9" cy="14" rx="3.5" ry="4" stroke="currentColor" strokeWidth="1.55" />
      <ellipse cx="16" cy="14.5" rx="3" ry="3.8" stroke="currentColor" strokeWidth="1.55" />
      <path d="M6 17c2 3 12 4 13 3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </>
  ),
  breeding: (
    <>
      <path
        d="M12 5c2 3 7 6 7 11a7 7 0 01-14 0c0-5 5-8 7-11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10.5" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="14.5" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="1.35" />
    </>
  ),
};

function HomeTileLink({ iconChildren, iconPremium, title, hint, locked, lockedHint, lockedAria, openAria, to }) {
  const cls = ['pp-homeTile', 'pp-homeTile--premium'];
  if (locked) cls.push('pp-homeTile--locked');

  const body = (
    <>
      <GreyIcon premium={iconPremium}>{iconChildren}</GreyIcon>
      <span className="pp-homeTile__title">{title}</span>
      {hint ? <span className="pp-homeTile__hint pp-homeTile__hint--premiumCard">{hint}</span> : null}
      {locked ? <span className="pp-homeTile__hint">{lockedHint}</span> : null}
    </>
  );

  if (locked) {
    return (
      <Link className={cls.join(' ')} to="/login" state={{ from: to }} aria-label={lockedAria}>
        {body}
      </Link>
    );
  }
  return (
    <Link className={cls.join(' ')} to={to} aria-label={openAria}>
      {body}
    </Link>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { isAdmin } = useCompany();
  const { t } = useI18n();

  const signInHint = t('home.signInToOpen');

  const standardTilesSpec = [
    { iconKey: 'dashboard', titleKey: 'home.tileDashboard', to: '/dashboard', auth: true },
    { iconKey: 'profile', titleKey: 'home.tileProfile', to: '/profile', auth: true },
    { iconKey: 'pets', titleKey: 'home.tilePets', to: '/pets', auth: true },
    { iconKey: 'community', titleKey: 'home.tileCommunity', to: '/community', auth: true },
    { iconKey: 'leaderboard', titleKey: 'home.tileLeaderboard', to: '/leaderboard', auth: true },
    { iconKey: 'nearby', titleKey: 'home.tileNearby', to: '/nearby', auth: true },
    { iconKey: 'tracking', titleKey: 'home.tileTracking', to: '/tracking', auth: true },
    { iconKey: 'business', titleKey: 'home.tileBusiness', to: '/company/apply', auth: true },
    { iconKey: 'docs', titleKey: 'home.tileDocs', to: '/docs', auth: false },
  ];

  const standardTiles = [
    ...standardTilesSpec.map((x) => ({
      iconKey: x.iconKey,
      title: t(x.titleKey),
      to: x.to,
      auth: x.auth,
    })),
    ...(isAdmin && user
      ? [{ iconKey: 'admin', title: t('home.tileAdmin'), to: '/admin/company-approvals', auth: true }]
      : []),
  ];

  const premiumToolsSpec = [
    {
      iconKey: 'lost',
      titleKey: 'premium.tabLost',
      hintKey: 'home.premiumCardLostHint',
      to: '/premium/lost',
    },
    {
      iconKey: 'stray',
      titleKey: 'premium.tabStray',
      hintKey: 'home.premiumCardStrayHint',
      to: '/premium/stray',
    },
    {
      iconKey: 'breeding',
      titleKey: 'premium.tabBreeding',
      hintKey: 'home.premiumCardBreedingHint',
      to: '/premium/breeding',
    },
  ];

  const premiumTools = premiumToolsSpec.map((x) => ({
    iconKey: x.iconKey,
    title: t(x.titleKey),
    hint: t(x.hintKey),
    to: x.to,
  }));

  const renderStandardTile = ({ iconKey, title, to, auth: authReq }) => {
    const locked = Boolean(authReq) && !user;
    const cls = ['pp-homeTile'];
    if (locked) cls.push('pp-homeTile--locked');

    const body = (
      <>
        <GreyIcon premium={false}>{ICONS[iconKey]}</GreyIcon>
        <span className="pp-homeTile__title">{title}</span>
        {locked ? <span className="pp-homeTile__hint">{signInHint}</span> : null}
      </>
    );

    const lockedAria = `${title}. ${signInHint}`;
    const openAria = title;

    if (locked) {
      return (
        <Link key={`${iconKey}-${to}`} className={cls.join(' ')} to="/login" state={{ from: to }} aria-label={lockedAria}>
          {body}
        </Link>
      );
    }
    return (
      <Link key={`${iconKey}-${to}`} className={cls.join(' ')} to={to} aria-label={openAria}>
        {body}
      </Link>
    );
  };

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad" style={{ maxWidth: 960, margin: '0 auto' }}>
          <div className="pp-badge">{t('home.badge')}</div>
          <h1 className="pp-h1" style={{ marginTop: 10 }}>
            {t('home.title')}
          </h1>
          <p className="pp-subtle" style={{ marginTop: 6, marginBottom: 22, maxWidth: 680 }}>
            {t('home.subtitle')}
          </p>

          <div className="pp-homeGrid">{standardTiles.map((tile) => renderStandardTile(tile))}</div>

          <section className="pp-homePremiumSection" aria-labelledby="premium-section-title">
            <div className="pp-homePremiumSection__head">
              <div className="pp-homePremiumSection__titles">
                <span className="pp-badge pp-badge--premium">{t('premium.badge')}</span>
                <h2 id="premium-section-title" className="pp-homePremiumSection__h2">
                  {t('premium.title')}
                </h2>
              </div>
              <p className="pp-subtle pp-homePremiumSection__intro">{t('premium.subtitle')}</p>
            </div>

            <div className="pp-homeGrid pp-homeGrid--premiumSub">
              {premiumTools.map(({ iconKey, title, hint, to }) => {
                const locked = !user;
                const lockedAria = `${title}. ${t('premium.title')}. ${signInHint}`;
                const openAria = `${title}. ${t('premium.badge')}`;

                return (
                  <HomeTileLink
                    key={to}
                    iconChildren={ICONS_PREMIUM[iconKey]}
                    iconPremium
                    title={title}
                    hint={hint}
                    locked={locked}
                    lockedHint={signInHint}
                    lockedAria={lockedAria}
                    openAria={openAria}
                    to={to}
                  />
                );
              })}
            </div>
          </section>

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

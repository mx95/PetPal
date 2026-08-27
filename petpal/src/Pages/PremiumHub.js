import React from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

function tabCls({ isActive }) {
  return `pp-btn ${isActive ? 'pp-btnPrimary' : ''}`;
}

const BENEFITS = [
  { key: 'lost', to: '/lost-pet', icon: '🚨', accent: 'lost' },
  { key: 'stray', to: '/shelters', icon: '🏠', accent: 'stray' },
  { key: 'breeding', to: '/premium/breeding', icon: '💞', accent: 'breeding' },
];

export default function PremiumHub() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const isHubRoot = pathname === '/premium' || pathname === '/premium/';

  return (
    <>
      <div className="pp-grid" style={{ marginBottom: 0 }}>
        <div className="pp-col-12">
          <header className="pp-pageHeader">
            <div className="pp-pageHeader__copy">
              <span className="pp-publicHero__eyebrow" style={{ display: 'inline-block', width: 'fit-content', background: 'rgba(217,161,0,0.14)', color: '#b54708' }}>
                {t('premium.badge')}
              </span>
              <h1 className="pp-pageHeader__title">{t('premium.heroTitle')}</h1>
              <p className="pp-pageHeader__sub">{t('premium.heroSub')}</p>
            </div>
            <Link className="pp-pageHeader__back" to="/">
              {t('common.backHome')}
            </Link>
          </header>
        </div>

        <div className="pp-col-12">
          <section className="pp-heroCard pp-heroCard--premium" aria-label={t('premium.title')}>
            <div className="pp-heroCard__avatar" aria-hidden style={{ background: 'conic-gradient(from 200deg, #ffb84d, #ff6fb0, #b14b8a, #ffb84d)' }}>
              <div style={{ width: 64, height: 64, display: 'grid', placeItems: 'center', fontSize: 30 }}>
                ✨
              </div>
            </div>
            <div className="pp-heroCard__copy">
              <span className="pp-heroCard__eyebrow">{t('premium.title')}</span>
              <h2 className="pp-heroCard__title">{t('premium.upgradeHeadline')}</h2>
              <p className="pp-heroCard__sub">{t('premium.upgradeSub')}</p>
              <div className="pp-heroCard__statRow">
                <span className="pp-heroCard__statChip">{t('premium.chipFast')}</span>
                <span className="pp-heroCard__statChip">{t('premium.chipCloud')}</span>
                <span className="pp-heroCard__statChip">{t('premium.chipFree')}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="pp-col-12">
          <h2 className="pp-feed__sectionTitle" style={{ margin: '6px 4px 12px' }}>
            {t('premium.benefitsTitle')}
          </h2>
          <div className="pp-actionGrid">
            {BENEFITS.map((b) => (
              <Link key={b.key} className={`pp-actionCard pp-actionCard--${b.accent}`} to={b.to}>
                <span className="pp-actionCard__icon" aria-hidden>{b.icon}</span>
                <div className="pp-actionCard__body">
                  <span className="pp-actionCard__title">{t(`premium.benefit.${b.key}.title`)}</span>
                  <span className="pp-actionCard__desc">{t(`premium.benefit.${b.key}.desc`)}</span>
                </div>
                <span className="pp-actionCard__arrow" aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </div>

        {!isHubRoot ? (
          <div className="pp-col-12">
            <nav className="pp-row" style={{ gap: 8, flexWrap: 'wrap' }} aria-label={t('premium.navAria')}>
              <NavLink to="/lost-pet" className={tabCls} end>
                {t('premium.tabLost')}
              </NavLink>
              <NavLink to="/shelters" className={tabCls}>
                {t('premium.tabStray')}
              </NavLink>
              <NavLink to="/premium/breeding" className={tabCls}>
                {t('premium.tabBreeding')}
              </NavLink>
            </nav>
          </div>
        ) : null}
      </div>
      <Outlet context={{ embedded: true }} />
    </>
  );
}

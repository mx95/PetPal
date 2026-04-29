import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

function tabCls({ isActive }) {
  return `pp-btn ${isActive ? 'pp-btnPrimary' : ''}`;
}

export default function PremiumHub() {
  const { t } = useI18n();

  return (
    <>
      <div className="pp-grid" style={{ marginBottom: 0 }}>
        <div className="pp-col-12">
          <div className="pp-card pp-pad" style={{ marginBottom: 16 }}>
            <div className="pp-badge pp-badge--premium">{t('premium.badge')}</div>
            <h1 className="pp-h1" style={{ marginTop: 10, marginBottom: 6 }}>
              {t('premium.title')}
            </h1>
            <p className="pp-subtle" style={{ margin: '0 0 8px', maxWidth: 720 }}>
              {t('premium.subtitle')}
            </p>
            <nav className="pp-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }} aria-label={t('premium.navAria')}>
              <NavLink to="/premium/lost" className={tabCls} end>
                {t('premium.tabLost')}
              </NavLink>
              <NavLink to="/premium/stray" className={tabCls}>
                {t('premium.tabStray')}
              </NavLink>
              <NavLink to="/premium/breeding" className={tabCls}>
                {t('premium.tabBreeding')}
              </NavLink>
            </nav>
          </div>
        </div>
      </div>
      <Outlet context={{ embedded: true }} />
    </>
  );
}

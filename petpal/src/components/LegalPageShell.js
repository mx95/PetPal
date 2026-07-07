import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';

export function LegalPageShell({ title, lastUpdated, children }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const back = user
    ? { to: '/', label: t('legal.backHome') }
    : { to: '/login', label: t('legal.backLogin') };

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-legalDoc">
          <Link className="pp-link pp-legalBack" to={back.to}>
            {back.label}
          </Link>
          <h1 className="pp-h1 pp-legalTitle">{title}</h1>
          <p className="pp-subtle pp-legalUpdated">
            <strong>{t('legal.lastUpdated')}</strong> {lastUpdated}
          </p>
          <div className="pp-legalBody">{children}</div>
        </div>
      </div>
    </div>
  );
}

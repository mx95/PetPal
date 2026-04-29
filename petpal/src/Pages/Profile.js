import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';

export default function Profile() {
  const { user } = useAuth();
  const { isAdmin } = useCompany();
  const { t } = useI18n();

  const items = [
    { to: '/pets', labelKey: 'nav.pets', descKey: 'profile.hintPets' },
    { to: '/company/apply', labelKey: 'nav.business', descKey: 'profile.hintBusiness' },
    { to: '/docs', labelKey: 'nav.docs', descKey: 'profile.hintDocs' },
    ...(isAdmin ? [{ to: '/admin/company-approvals', labelKey: 'nav.admin', descKey: 'profile.hintAdmin' }] : []),
  ];

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="pp-badge">{t('profile.badge')}</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('profile.title')}
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6 }}>
              {user?.email ?? ''}
            </p>
          </div>
          <Link className="pp-link" to="/">
            {t('profile.backHome')}
          </Link>
        </div>
      </div>

      <div className="pp-col-12" style={{ maxWidth: 640 }}>
        <p className="pp-subtle" style={{ marginBottom: 14 }}>
          {t('profile.intro')}
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(({ to, labelKey, descKey }) => (
            <li key={to}>
              <Link className="pp-card pp-pad pp-profileLinkRow" to={to} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <strong>{t(labelKey)}</strong>
                <div className="pp-subtle" style={{ marginTop: 4, fontSize: 13 }}>
                  {t(descKey)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

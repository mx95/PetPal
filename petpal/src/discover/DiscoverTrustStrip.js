import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

const BADGES = [
  { icon: '🔒', titleKey: 'discover.trust.secure' },
  { icon: '✓', titleKey: 'discover.trust.verified' },
  { icon: '🛡️', titleKey: 'discover.trust.safety' },
];

export default function DiscoverTrustStrip({ loggedIn }) {
  const { t } = useI18n();
  return (
    <section className="pp-dTrust pp-dTrust--minimal">
      <ul className="pp-dTrust__chips">
        {BADGES.map((b) => (
          <li key={b.titleKey} className="pp-dTrust__chip">
            <span aria-hidden>{b.icon}</span>
            {t(b.titleKey)}
          </li>
        ))}
      </ul>
      {!loggedIn ? (
        <Link className="pp-dTrust__join" to="/register">
          {t('discover.trust.ctaJoin')}
        </Link>
      ) : null}
    </section>
  );
}

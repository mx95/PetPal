import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

const BADGES = [
  { icon: '🔒', titleKey: 'discover.trust.secure', descKey: 'discover.trust.secureDesc' },
  { icon: '✓', titleKey: 'discover.trust.verified', descKey: 'discover.trust.verifiedDesc' },
  { icon: '🛡️', titleKey: 'discover.trust.safety', descKey: 'discover.trust.safetyDesc' },
  { icon: '📞', titleKey: 'discover.trust.support', descKey: 'discover.trust.supportDesc' },
];

export default function DiscoverTrustStrip({ loggedIn }) {
  const { t } = useI18n();
  return (
    <section className="pp-dTrust">
      <div className="pp-dTrust__inner">
        <div className="pp-dTrust__intro">
          <h2 className="pp-dTrust__title">{t('discover.trust.title')}</h2>
          <p className="pp-dTrust__sub">{t('discover.trust.sub')}</p>
          {!loggedIn ? (
            <Link className="pp-btn pp-btnPrimary" to="/register">
              {t('discover.trust.ctaJoin')}
            </Link>
          ) : null}
        </div>
        <ul className="pp-dTrust__badges">
          {BADGES.map((b) => (
            <li key={b.titleKey} className="pp-dTrust__badge">
              <span className="pp-dTrust__badgeIcon" aria-hidden>
                {b.icon}
              </span>
              <div>
                <strong>{t(b.titleKey)}</strong>
                <p>{t(b.descKey)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

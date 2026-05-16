import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { DISCOVER_SERVICES } from '../data/discoverFeed';

export default function DiscoverServices() {
  const { t } = useI18n();
  return (
    <section className="pp-dServices">
      <div className="pp-dSectionHead">
        <h2 className="pp-dSectionHead__title">{t('discover.services.title')}</h2>
        <p className="pp-dSectionHead__sub">{t('discover.services.sub')}</p>
      </div>
      <div className="pp-dServices__grid">
        {DISCOVER_SERVICES.map((s) => (
          <Link key={s.id} className="pp-dServiceCard" to={s.to} style={{ '--pp-d-svc-bg': s.gradient }}>
            <span className="pp-dServiceCard__icon" aria-hidden>
              {s.icon}
            </span>
            <strong>{t(s.titleKey)}</strong>
            <p>{t(s.descKey)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { DISCOVER_SERVICES } from '../data/discoverFeed';

const VISIBLE = ['gps', 'vet', 'walk', 'nearby'];

export default function DiscoverServices() {
  const { t } = useI18n();
  const items = DISCOVER_SERVICES.filter((s) => VISIBLE.includes(s.id));

  return (
    <section className="pp-dServices pp-dServices--light">
      <div className="pp-dSectionHead pp-dSectionHead--compact">
        <h2 className="pp-dSectionHead__title">{t('discover.services.title')}</h2>
        <Link className="pp-dSectionHead__link" to="/documentation">
          {t('discover.feed.readMore')}
        </Link>
      </div>
      <div className="pp-dServices__grid">
        {items.map((s) => (
          <Link key={s.id} className="pp-dServiceCard pp-dServiceCard--neutral" to={s.to}>
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

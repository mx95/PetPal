import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { DISCOVER_COMMUNITY_PETS, DISCOVER_SERVICES } from '../data/discoverFeed';
import PetAvatar from '../components/PetAvatar';

const NEARBY_SPOTS = [
  { id: 'vet', icon: '🏥', labelKey: 'discover.actions.vets', to: '/nearby' },
  { id: 'groom', icon: '✂️', labelKey: 'discover.actions.groomers', to: '/nearby' },
  { id: 'shop', icon: '🛒', labelKey: 'discover.actions.shops', to: '/nearby' },
];

/** One contextual widget at a time — community, nearby, or a service highlight. */
export default function DiscoverContextualRail({ pets }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);

  const communityItems =
    pets?.length > 0
      ? pets.slice(0, 4).map((p) => ({
          id: p.id,
          name: p.name,
          story: t('discover.community.yourPet'),
          pet: p,
        }))
      : DISCOVER_COMMUNITY_PETS.slice(0, 4).map((c) => ({
          ...c,
          story: t(c.storyKey),
          pet: null,
        }));

  const service = DISCOVER_SERVICES[0];

  const panels = [
    {
      id: 'community',
      label: t('discover.community.title'),
      content: (
        <div className="pp-dRailPanel__body pp-dRailPanel__body--scroll">
          {communityItems.map((item) => (
            <Link key={item.id} className="pp-dRailChip" to={item.pet ? `/pet/${item.pet.id}` : '/community'}>
              <span className="pp-dRailChip__avatar">
                {item.pet ? <PetAvatar pet={item.pet} size={40} /> : <span aria-hidden>{item.emoji}</span>}
              </span>
              <span className="pp-dRailChip__text">
                <strong>{item.name}</strong>
                <small>{item.story}</small>
              </span>
            </Link>
          ))}
        </div>
      ),
    },
    {
      id: 'nearby',
      label: t('discover.nearby.title'),
      content: (
        <div className="pp-dRailPanel__body pp-dRailPanel__body--grid">
          {NEARBY_SPOTS.map((s) => (
            <Link key={s.id} className="pp-dRailSpot" to={s.to}>
              <span aria-hidden>{s.icon}</span>
              <strong>{t(s.labelKey)}</strong>
            </Link>
          ))}
          <Link className="pp-dRailSpot pp-dRailSpot--cta" to="/nearby">
            <strong>{t('discover.community.seeAll')}</strong>
            <small>{t('discover.hero.ctaExplore')}</small>
          </Link>
        </div>
      ),
    },
    {
      id: 'service',
      label: t('discover.services.title'),
      content: (
        <Link className="pp-dRailService" to={service.to}>
          <span className="pp-dRailService__icon" aria-hidden>
            {service.icon}
          </span>
          <div>
            <strong>{t(service.titleKey)}</strong>
            <p>{t(service.descKey)}</p>
          </div>
          <span className="pp-dRailService__arrow" aria-hidden>
            →
          </span>
        </Link>
      ),
    },
  ];

  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % panels.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [panels.length]);

  const panel = panels[idx];

  return (
    <section className="pp-dRail" aria-label={t('discover.contextual.aria')}>
      <div className="pp-dRail__head">
        <h2 className="pp-dRail__title">{panel.label}</h2>
        <div className="pp-dRail__dots" role="tablist" aria-label={t('discover.contextual.aria')}>
          {panels.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              className={`pp-dRail__dot${i === idx ? ' is-on' : ''}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      </div>
      <div key={panel.id} className="pp-dRailPanel">
        {panel.content}
      </div>
    </section>
  );
}

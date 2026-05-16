import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { DISCOVER_COMMUNITY_PETS } from '../data/discoverFeed';
import PetAvatar from '../components/PetAvatar';

export default function DiscoverCommunityCarousel({ pets }) {
  const { t } = useI18n();
  const items =
    pets?.length > 0
      ? pets.slice(0, 6).map((p) => ({
          id: p.id,
          name: p.name,
          emoji: null,
          story: t('discover.community.yourPet'),
          pet: p,
        }))
      : DISCOVER_COMMUNITY_PETS.map((c) => ({ ...c, story: t(c.storyKey), pet: null }));

  return (
    <section className="pp-dCommunity">
      <div className="pp-dSectionHead">
        <h2 className="pp-dSectionHead__title">{t('discover.community.title')}</h2>
        <Link className="pp-dSectionHead__link" to="/community">
          {t('discover.community.seeAll')}
        </Link>
      </div>
      <div className="pp-dCommunity__row">
        {items.map((item) => (
          <Link key={item.id} className="pp-dCommunity__card" to={item.pet ? `/pet/${item.pet.id}` : '/community'}>
            <div className="pp-dCommunity__avatar">
              {item.pet ? <PetAvatar pet={item.pet} size={52} /> : <span aria-hidden>{item.emoji}</span>}
            </div>
            <strong>{item.name}</strong>
            <span>{item.story}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

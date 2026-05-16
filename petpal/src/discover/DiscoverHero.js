import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { HERO_ROTATION_KEYS } from '../data/discoverFeed';
import PetAvatar from '../components/PetAvatar';

export default function DiscoverHero({ user, pets }) {
  const { t } = useI18n();
  const [rotateIdx, setRotateIdx] = useState(0);
  const pet = pets?.[0] || null;

  useEffect(() => {
    const id = window.setInterval(() => {
      setRotateIdx((i) => (i + 1) % HERO_ROTATION_KEYS.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  const rot = HERO_ROTATION_KEYS[rotateIdx];

  return (
    <section className="pp-dHero" aria-labelledby="discover-hero-title">
      <div className="pp-dHero__glow pp-dHero__glow--a" aria-hidden />
      <div className="pp-dHero__glow pp-dHero__glow--b" aria-hidden />
      <div className="pp-dHero__inner">
        <div className="pp-dHero__copy">
          {user ? (
            <p className="pp-dHero__greet">
              {t('discover.hero.greet', { name: user.displayName?.split(' ')[0] || t('discover.hero.friend') })}
            </p>
          ) : (
            <p className="pp-dHero__greet">{t('discover.hero.guestGreet')}</p>
          )}
          <h1 id="discover-hero-title" className="pp-dHero__title">
            {t('discover.hero.headline')}
          </h1>
          <p className="pp-dHero__sub">{t('discover.hero.subtitle')}</p>
          <div className="pp-dHero__cta">
            <Link className="pp-btn pp-btnPrimary pp-dHero__btn" to="/nearby">
              {t('discover.hero.ctaExplore')}
            </Link>
            <Link className="pp-btn pp-btn--glass pp-dHero__btn" to="/tracking">
              {t('discover.hero.ctaTrack')}
            </Link>
          </div>
        </div>

        <div className="pp-dHero__visual">
          <div className="pp-dHero__cardStack">
            {pet ? (
              <div className="pp-dHero__petCard">
                <PetAvatar pet={pet} size={56} />
                <div>
                  <strong>{pet.name}</strong>
                  <span>{t('discover.hero.petReady')}</span>
                </div>
              </div>
            ) : null}
            <div className="pp-dHero__tipCard" key={rotateIdx}>
              <span className="pp-dHero__tipLabel">{t('discover.hero.spotlight')}</span>
              <strong>{t(rot.titleKey)}</strong>
              <p>{t(rot.subKey)}</p>
            </div>
            <div className="pp-dHero__float pp-dHero__float--paw" aria-hidden>
              🐾
            </div>
            <div className="pp-dHero__float pp-dHero__float--heart" aria-hidden>
              ♥
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

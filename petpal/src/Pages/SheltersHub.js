import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PhotoFeedCard from '../components/media/PhotoFeedCard';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { subscribeAvailableShelterAnimals } from '../shelter/shelterAnimalFirestore';
import { subscribeApprovedShelters } from '../shelter/shelterFirestore';
import { CYPRUS_CITIES } from '../shelter/shelterUtils';
import { lostPetSpeciesLabel } from '../lostPet/lostPetUtils';

export default function SheltersHub() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isShelterAccount, isApprovedShelter, shelterProfile } = useCompany();
  const [shelters, setShelters] = useState(/** @type {import('../shelter/shelterTypes').ShelterProfile[]} */ ([]));
  const [animals, setAnimals] = useState(/** @type {import('../shelter/shelterTypes').ShelterAnimal[]} */ ([]));
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('all');
  const [species, setSpecies] = useState('all');

  useEffect(() => {
    const off1 = subscribeApprovedShelters(setShelters);
    const off2 = subscribeAvailableShelterAnimals(setAnimals);
    return () => {
      off1();
      off2();
    };
  }, []);

  const filteredShelters = useMemo(() => {
    let rows = shelters;
    if (city !== 'all') rows = rows.filter((s) => s.city === city);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((s) => s.shelterName.toLowerCase().includes(q) || s.city.toLowerCase().includes(q));
    }
    return rows;
  }, [shelters, city, search]);

  const filteredAnimals = useMemo(() => {
    let rows = animals;
    if (species !== 'all') rows = rows.filter((a) => a.categoryId === species);
    if (city !== 'all') {
      const shelterIds = new Set(filteredShelters.map((s) => s.id));
      rows = rows.filter((a) => shelterIds.has(a.shelterId));
    }
    return rows;
  }, [animals, species, city, filteredShelters]);

  const shelterById = useMemo(() => Object.fromEntries(shelters.map((s) => [s.id, s])), [shelters]);

  const showRegisterBlock = !isApprovedShelter || !user;
  const registerTitle = !user
    ? t('shelters.registerTitle')
    : isShelterAccount
      ? t('shelters.pendingTitle')
      : t('shelters.registerTitle');

  return (
    <div className="pp-grid pp-sheltersHub">
      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-sheltersHubHero">
          <span className="pp-publicHero__eyebrow pp-publicHero__eyebrow--shelter">{t('shelters.badge')}</span>
          <h1 className="pp-pageHeader__title">{t('shelters.title')}</h1>
          <p className="pp-pageHeader__sub">{t('shelters.tagline')}</p>

          {showRegisterBlock ? (
            <div className="pp-sheltersHubHero__register">
              <h2 className="pp-sectionTitle pp-sheltersHubHero__registerTitle">{registerTitle}</h2>
              {!user ? <p className="pp-subtle">{t('shelters.registerGuestDesc')}</p> : null}
              {user && isShelterAccount ? <p className="pp-subtle">{t('shelters.pendingDesc')}</p> : null}
              {!isShelterAccount ? (
                <Link className="pp-btn pp-btnPrimary" to={user ? '/shelter/apply' : '/login'}>
                  {user ? t('shelters.registerCta') : t('shelters.registerGuestCta')}
                </Link>
              ) : null}
            </div>
          ) : null}

          {isApprovedShelter && shelterProfile?.id ? (
            <Link className="pp-btn pp-btnPrimary pp-sheltersHubHero__dashboard" to="/shelter/dashboard">
              {t('shelters.openDashboard')}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <div className="pp-filterRow">
            <input
              className="pp-input"
              placeholder={t('shelters.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="pp-input" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="all">{t('shelters.allCities')}</option>
              {CYPRUS_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="pp-col-12">
        <h2 className="pp-sectionTitle">{t('shelters.approvedShelters')}</h2>
        {!filteredShelters.length ? <p className="pp-subtle">{t('shelters.noShelters')}</p> : null}
        <div className="pp-photoFeed pp-photoFeed--grid">
          {filteredShelters.map((shelter) => (
            <PhotoFeedCard
              key={shelter.id}
              photoUrl={shelter.coverPhotoUrl || shelter.logoUrl}
              placeholderEmoji="🏠"
              statusLabel={t('shelters.approvedBadge')}
              statusTone="shelter"
              title={shelter.shelterName}
              subtitle={[shelter.city, shelter.addressLine].filter(Boolean).join(' · ')}
              description={shelter.description}
              detailHref={`/shelters/${shelter.id}`}
              phone={shelter.phoneNumber}
              secondaryAction={{ label: t('shelters.viewShelter'), href: `/shelters/${shelter.id}` }}
            />
          ))}
        </div>
      </div>

      <div className="pp-col-12">
        <h2 className="pp-sectionTitle">{t('shelters.availableAnimals')}</h2>
        <div className="pp-chipRow" style={{ marginBottom: 12 }}>
          <button type="button" className={`pp-chip${species === 'all' ? ' is-on' : ''}`} onClick={() => setSpecies('all')}>
            {t('shelters.allSpecies')}
          </button>
          <button type="button" className={`pp-chip${species === 'dog' ? ' is-on' : ''}`} onClick={() => setSpecies('dog')}>
            🐕
          </button>
          <button type="button" className={`pp-chip${species === 'cat' ? ' is-on' : ''}`} onClick={() => setSpecies('cat')}>
            🐈
          </button>
        </div>
        {!filteredAnimals.length ? <p className="pp-subtle">{t('shelters.noAnimals')}</p> : null}
        <div className="pp-photoFeed">
          {filteredAnimals.map((animal) => {
            const shelter = shelterById[animal.shelterId];
            return (
              <PhotoFeedCard
                key={animal.id}
                photoUrl={animal.primaryPhotoUrl}
                statusLabel={t(`shelters.animalStatus.${animal.adoptionStatus}`)}
                statusTone="available"
                title={animal.name}
                subtitle={[lostPetSpeciesLabel(animal.categoryId, t), animal.breed, animal.age].filter(Boolean).join(' · ')}
                metaLines={[shelter ? `${t('shelters.fromShelter')}: ${shelter.shelterName}` : ''].filter(Boolean)}
                description={animal.description}
                detailHref={`/shelters/animal/${animal.id}`}
                secondaryAction={{ label: t('shelters.viewAnimal'), href: `/shelters/animal/${animal.id}` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PhotoFeedCard from '../components/media/PhotoFeedCard';
import { useI18n } from '../i18n/I18nContext';
import { mapsLink, telHref } from '../media/photoUploadUtils';
import { subscribeShelterAnimals } from '../shelter/shelterAnimalFirestore';
import { fetchShelterById } from '../shelter/shelterFirestore';
import { isPublicShelterStatus } from '../shelter/shelterUtils';
import { lostPetSpeciesLabel } from '../lostPet/lostPetUtils';

export default function ShelterPublicProfile() {
  const { shelterId } = useParams();
  const { t } = useI18n();
  const [shelter, setShelter] = useState(/** @type {import('../shelter/shelterTypes').ShelterProfile | null} */ (null));
  const [animals, setAnimals] = useState(/** @type {import('../shelter/shelterTypes').ShelterAnimal[]} */ ([]));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const row = await fetchShelterById(shelterId);
      if (!cancelled) {
        setShelter(row);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shelterId]);

  useEffect(() => {
    if (!shelterId) return undefined;
    return subscribeShelterAnimals(shelterId, setAnimals);
  }, [shelterId]);

  if (loading) return <p className="pp-subtle">{t('common.loading')}</p>;
  if (!shelter || !isPublicShelterStatus(shelter.status)) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">{t('shelters.notFound')}</p>
          <Link className="pp-link" to="/shelters">
            {t('shelters.backToBrowse')}
          </Link>
        </div>
      </div>
    );
  }

  const mapUrl = mapsLink(shelter.lat, shelter.lng);
  const tel = telHref(shelter.phoneNumber);
  const availableAnimals = animals.filter((a) => a.adoptionStatus === 'available' || a.adoptionStatus === 'foster');

  return (
    <div className="pp-grid pp-shelterProfile">
      <div className="pp-col-12">
        <Link className="pp-pageHeader__back" to="/shelters">
          ← {t('shelters.backToBrowse')}
        </Link>
      </div>
      <div className="pp-col-12">
        <div className="pp-shelterProfileHero">
          {shelter.coverPhotoUrl ? <img src={shelter.coverPhotoUrl} alt="" className="pp-shelterProfileHero__cover" /> : null}
          <div className="pp-shelterProfileHero__body">
            {shelter.logoUrl ? <img src={shelter.logoUrl} alt="" className="pp-shelterProfileHero__logo" /> : null}
            <h1>{shelter.shelterName}</h1>
            <span className="pp-statusBadge pp-statusBadge--approved">{t('shelters.approvedBadge')}</span>
            <p className="pp-subtle">{[shelter.city, shelter.addressLine].filter(Boolean).join(' · ')}</p>
            <p>{shelter.description}</p>
            <div className="pp-photoFeedCard__actions">
              {tel ? (
                <a className="pp-btn pp-btnPrimary" href={tel}>
                  {t('photos.call')}
                </a>
              ) : null}
              {mapUrl ? (
                <a className="pp-btn" href={mapUrl} target="_blank" rel="noreferrer">
                  {t('shelters.directions')}
                </a>
              ) : null}
              {shelter.website ? (
                <a className="pp-btn pp-btnGhost" href={shelter.website} target="_blank" rel="noreferrer">
                  {t('shelters.website')}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="pp-col-12">
        <h2 className="pp-sectionTitle">{t('shelters.animalsForAdoption')}</h2>
        {!availableAnimals.length ? <p className="pp-subtle">{t('shelters.noAnimals')}</p> : null}
        <div className="pp-photoFeed">
          {availableAnimals.map((animal) => (
            <PhotoFeedCard
              key={animal.id}
              photoUrl={animal.primaryPhotoUrl}
              statusLabel={t(`shelters.animalStatus.${animal.adoptionStatus}`)}
              statusTone="available"
              title={animal.name}
              subtitle={[lostPetSpeciesLabel(animal.categoryId, t), animal.breed, animal.age].filter(Boolean).join(' · ')}
              description={animal.description}
              detailHref={`/shelters/animal/${animal.id}`}
              secondaryAction={{ label: t('shelters.viewAnimal'), href: `/shelters/animal/${animal.id}` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

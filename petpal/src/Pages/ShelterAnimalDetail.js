import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PhotoGallery from '../components/media/PhotoGallery';
import { useI18n } from '../i18n/I18nContext';
import { telHref } from '../media/photoUploadUtils';
import { fetchShelterAnimalById } from '../shelter/shelterAnimalFirestore';
import { fetchShelterById } from '../shelter/shelterFirestore';
import { isPublicShelterAnimal, isPublicShelterStatus } from '../shelter/shelterUtils';
import { lostPetSpeciesLabel } from '../lostPet/lostPetUtils';

export default function ShelterAnimalDetail() {
  const { animalId } = useParams();
  const { t } = useI18n();
  const [animal, setAnimal] = useState(/** @type {import('../shelter/shelterTypes').ShelterAnimal | null} */ (null));
  const [shelter, setShelter] = useState(/** @type {import('../shelter/shelterTypes').ShelterProfile | null} */ (null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const row = await fetchShelterAnimalById(animalId);
      if (cancelled) return;
      setAnimal(row);
      if (row?.shelterId) {
        const s = await fetchShelterById(row.shelterId);
        if (!cancelled) setShelter(s);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  if (loading) return <p className="pp-subtle">{t('common.loading')}</p>;
  if (!animal || !isPublicShelterAnimal(animal) || !shelter || !isPublicShelterStatus(shelter.status)) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">{t('shelters.animalNotFound')}</p>
          <Link className="pp-link" to="/shelters">
            {t('shelters.backToBrowse')}
          </Link>
        </div>
      </div>
    );
  }

  const tel = telHref(shelter.phoneNumber);

  return (
    <div className="pp-grid pp-shelterAnimalDetail">
      <div className="pp-col-12">
        <Link className="pp-pageHeader__back" to={`/shelters/${shelter.id}`}>
          ← {shelter.shelterName}
        </Link>
      </div>
      <div className="pp-col-12">
        <PhotoGallery photos={animal.photos.length ? animal.photos : [{ url: animal.primaryPhotoUrl }]} />
      </div>
      <div className="pp-col-12 pp-card pp-pad">
        <span className="pp-statusBadge pp-statusBadge--available">{t(`shelters.animalStatus.${animal.adoptionStatus}`)}</span>
        <h1 className="pp-pageHeader__title">{animal.name}</h1>
        <p className="pp-subtle">
          {[lostPetSpeciesLabel(animal.categoryId, t), animal.breed, animal.age, animal.sex, animal.size]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p style={{ marginTop: 12, lineHeight: 1.6 }}>{animal.description}</p>
        {animal.personality ? (
          <p className="pp-subtle" style={{ marginTop: 10 }}>
            <strong>{t('shelters.animalPersonality')}:</strong> {animal.personality}
          </p>
        ) : null}
        <p className="pp-subtle" style={{ marginTop: 12 }}>
          {t('shelters.fromShelter')}: <Link to={`/shelters/${shelter.id}`}>{shelter.shelterName}</Link>
        </p>
        <div className="pp-photoFeedCard__actions" style={{ marginTop: 16 }}>
          {tel ? (
            <a className="pp-btn pp-btnPrimary" href={tel}>
              {t('shelters.contactShelter')}
            </a>
          ) : null}
          <Link className="pp-btn" to={`/shelters/${shelter.id}`}>
            {t('shelters.viewShelter')}
          </Link>
        </div>
      </div>
    </div>
  );
}

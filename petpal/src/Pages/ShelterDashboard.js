import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import MultiPhotoUpload from '../components/media/MultiPhotoUpload';
import PhotoFeedCard from '../components/media/PhotoFeedCard';
import { PrettySelect } from '../components/PrettySelect';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { uploadPhotoDrafts } from '../media/scopedPhotoStorage';
import { normalizePrimaryPhoto } from '../media/photoUploadUtils';
import { PET_CATEGORIES } from '../pets/petCategories';
import {
  createShelterAnimal,
  subscribeShelterAnimals,
  updateShelterAnimal,
} from '../shelter/shelterAnimalFirestore';
import { canManageShelter } from '../shelter/shelterUtils';

export default function ShelterDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const { shelterProfile, isApprovedShelter } = useCompany();
  const [animals, setAnimals] = useState(/** @type {import('../shelter/shelterTypes').ShelterAnimal[]} */ ([]));
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('dog');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [size, setSize] = useState('');
  const [description, setDescription] = useState('');
  const [personality, setPersonality] = useState('');
  const [photoDrafts, setPhotoDrafts] = useState(/** @type {import('../media/photoUploadUtils').PhotoDraft[]} */ ([]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shelterProfile?.id) return undefined;
    return subscribeShelterAnimals(shelterProfile.id, setAnimals);
  }, [shelterProfile?.id]);

  if (!isApprovedShelter || !canManageShelter(shelterProfile, uid)) {
    return <Navigate to="/shelter/apply" replace />;
  }

  async function onCreateAnimal(e) {
    e.preventDefault();
    setError('');
    if (!photoDrafts.length) {
      setError(t('shelters.animalPhotoRequired'));
      return;
    }
    setBusy(true);
    try {
      const draftId = `animal_${Date.now()}`;
      const photos = await uploadPhotoDrafts(normalizePrimaryPhoto(photoDrafts), {
        uid,
        scope: 'shelterAnimalPhotos',
        entityId: draftId,
      });
      await createShelterAnimal(uid, shelterProfile.id, {
        name,
        categoryId,
        breed,
        age,
        sex,
        size,
        description,
        personality,
        photos,
        adoptionStatus: 'available',
        location: shelterProfile.city,
      });
      setName('');
      setBreed('');
      setAge('');
      setSex('');
      setSize('');
      setDescription('');
      setPersonality('');
      setPhotoDrafts([]);
      setFormOpen(false);
    } catch (err) {
      setError(err?.message || t('shelters.animalSaveErr'));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(animalId, adoptionStatus) {
    await updateShelterAnimal(animalId, uid, { adoptionStatus });
  }

  return (
    <div className="pp-grid pp-shelterDashboard">
      <div className="pp-col-12">
        <header className="pp-pageHeader">
          <div className="pp-pageHeader__copy">
            <h1 className="pp-pageHeader__title">{t('shelters.dashboardTitle')}</h1>
            <p className="pp-pageHeader__sub">{shelterProfile.shelterName}</p>
          </div>
          <Link className="pp-pageHeader__back" to={`/shelters/${shelterProfile.id}`}>
            {t('shelters.viewPublicProfile')}
          </Link>
        </header>
      </div>

      <div className="pp-col-12 pp-card pp-pad">
        <button type="button" className="pp-expandTrigger" aria-expanded={formOpen} onClick={() => setFormOpen((v) => !v)}>
          <span className="pp-expandTrigger__icon">{formOpen ? '−' : '+'}</span>
          <span className="pp-expandTrigger__text">
            <span className="pp-expandTrigger__title">{t('shelters.addAnimal')}</span>
            <span className="pp-expandTrigger__desc">{t('shelters.addAnimalDesc')}</span>
          </span>
        </button>
        {formOpen ? (
          <form className="pp-form pp-expandPanel" onSubmit={onCreateAnimal}>
            <MultiPhotoUpload photos={photoDrafts} onChange={setPhotoDrafts} disabled={busy} />
            <div>
              <label className="pp-label">{t('shelters.animalName')}</label>
              <input className="pp-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="pp-label">{t('shelters.animalSpecies')}</label>
              <PrettySelect value={categoryId} onChange={setCategoryId}>
                {PET_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {t(`pets.categories.${c.id}`)}
                  </option>
                ))}
              </PrettySelect>
            </div>
            <div className="pp-formRow">
              <div>
                <label className="pp-label">{t('shelters.animalBreed')}</label>
                <input className="pp-input" value={breed} onChange={(e) => setBreed(e.target.value)} />
              </div>
              <div>
                <label className="pp-label">{t('shelters.animalAge')}</label>
                <input className="pp-input" value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
            </div>
            <div className="pp-formRow">
              <div>
                <label className="pp-label">{t('shelters.animalSex')}</label>
                <input className="pp-input" value={sex} onChange={(e) => setSex(e.target.value)} />
              </div>
              <div>
                <label className="pp-label">{t('shelters.animalSize')}</label>
                <input className="pp-input" value={size} onChange={(e) => setSize(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="pp-label">{t('shelters.animalDescription')}</label>
              <textarea className="pp-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <div>
              <label className="pp-label">{t('shelters.animalPersonality')}</label>
              <textarea className="pp-input" rows={2} value={personality} onChange={(e) => setPersonality(e.target.value)} />
            </div>
            {error ? <p className="pp-error">{error}</p> : null}
            <button className="pp-btn pp-btnPrimary" type="submit" disabled={busy}>
              {busy ? t('common.saving') : t('shelters.saveAnimal')}
            </button>
          </form>
        ) : null}
      </div>

      <div className="pp-col-12">
        <h2 className="pp-sectionTitle">{t('shelters.yourAnimals')}</h2>
        <div className="pp-photoFeed">
          {animals.map((animal) => (
            <PhotoFeedCard
              key={animal.id}
              photoUrl={animal.primaryPhotoUrl}
              statusLabel={t(`shelters.animalStatus.${animal.adoptionStatus}`)}
              statusTone="available"
              title={animal.name}
              subtitle={[animal.breed, animal.age].filter(Boolean).join(' · ')}
              description={animal.description}
              detailHref={`/shelters/animal/${animal.id}`}
              secondaryAction={
                animal.adoptionStatus === 'available'
                  ? { label: t('shelters.markPending'), onClick: () => setStatus(animal.id, 'pending') }
                  : animal.adoptionStatus === 'pending'
                    ? { label: t('shelters.markAdopted'), onClick: () => setStatus(animal.id, 'adopted') }
                    : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

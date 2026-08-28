import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MultiPhotoUpload from '../components/media/MultiPhotoUpload';
import PhotoFeedCard from '../components/media/PhotoFeedCard';
import { PrettySelect } from '../components/PrettySelect';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useLostPet } from '../lostPet/LostPetContext';
import { lostPetSpeciesLabel } from '../lostPet/lostPetUtils';
import { usePets } from '../pets/PetsContext';
import { formatWhen, shareListing } from '../media/photoUploadUtils';

export default function LostPetAlerts() {
  const { t } = useI18n();
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const { pets, getCategory } = usePets();
  const { activeListings, myActiveAlerts, loading, feedError, publishAlert, resolveAlert } = useLostPet();

  const [createExpanded, setCreateExpanded] = useState(false);
  const [petId, setPetId] = useState('');
  const [description, setDescription] = useState('');
  const [identifyingMarks, setIdentifyingMarks] = useState('');
  const [lastSeenText, setLastSeenText] = useState('');
  const [lastSeenAt, setLastSeenAt] = useState('');
  const [lastSeenLat, setLastSeenLat] = useState('');
  const [lastSeenLng, setLastSeenLng] = useState('');
  const [reward, setReward] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [photoDrafts, setPhotoDrafts] = useState(/** @type {import('../media/photoUploadUtils').PhotoDraft[]} */ ([]));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resolveBusy, setResolveBusy] = useState('');
  const petSelectId = useId();

  const sortedPets = useMemo(() => [...pets].sort((a, b) => a.name.localeCompare(b.name)), [pets]);
  const selectedPet = pets.find((p) => p.id === petId) || null;

  useEffect(() => {
    if (!petId) {
      setPhotoDrafts([]);
      return;
    }
    const pet = pets.find((p) => p.id === petId);
    if (!pet) return;
    if (pet.ownerPhone) setContactPhone((prev) => prev || pet.ownerPhone);
    const seedUrl = pet.photoUrl || pet.photoDataUrl;
    setPhotoDrafts(
      seedUrl ? [{ id: 'seed', previewUrl: seedUrl, photoUrl: seedUrl, isPrimary: true }] : []
    );
  }, [petId, pets]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!petId) {
      setFormError(t('lostPet.errSelectPet'));
      return;
    }
    if (!photoDrafts.length) {
      setFormError(t('lostPet.errPhotoRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const pet = pets.find((p) => p.id === petId);
      const r = await publishAlert({
        petId,
        petName: pet?.name || '',
        categoryId: pet?.categoryId || 'other',
        breed: pet?.breed || '',
        description,
        identifyingMarks,
        lastSeenText,
        lastSeenAt: lastSeenAt || new Date().toISOString(),
        lastSeenLat: lastSeenLat.trim() ? Number(lastSeenLat) : null,
        lastSeenLng: lastSeenLng.trim() ? Number(lastSeenLng) : null,
        reward,
        contactPhone,
        additionalInfo,
        photoDrafts,
      });
      if (!r.ok) {
        if (r.error === 'description') setFormError(t('lostPet.errDesc'));
        else if (r.error === 'lastSeen') setFormError(t('lostPet.errLast'));
        else if (r.error === 'phone') setFormError(t('lostPet.errPhone'));
        else if (r.error === 'photo_upload') setFormError(t('lostPet.errPhotoUpload'));
        else setFormError(t('lostPet.errGeneric'));
        return;
      }
      setDescription('');
      setIdentifyingMarks('');
      setLastSeenText('');
      setLastSeenAt('');
      setLastSeenLat('');
      setLastSeenLng('');
      setReward('');
      setAdditionalInfo('');
      setPhotoDrafts([]);
      setCreateExpanded(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function onMarkFound(id) {
    setResolveBusy(id);
    try {
      await resolveAlert(id);
    } finally {
      setResolveBusy('');
    }
  }

  return (
    <div className="pp-grid pp-lostPetPage">
      <div className="pp-col-12">
        <header className="pp-pageHeader">
          <div className="pp-pageHeader__copy">
            <span className="pp-publicHero__eyebrow pp-publicHero__eyebrow--lost">{t('lostPet.badge')}</span>
            <h1 className="pp-pageHeader__title">{t('lostPet.title')}</h1>
            <p className="pp-pageHeader__sub">{t('lostPet.tagline')}</p>
          </div>
        </header>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <button
            type="button"
            className="pp-expandTrigger"
            aria-expanded={createExpanded}
            onClick={() => setCreateExpanded((v) => !v)}
          >
            <span className="pp-expandTrigger__icon">{createExpanded ? '−' : '+'}</span>
            <span className="pp-expandTrigger__text">
              <span className="pp-expandTrigger__title">{t('lostPet.createTitle')}</span>
              <span className="pp-expandTrigger__desc">{t('lostPet.createDesc')}</span>
            </span>
            <span className={`pp-expandTrigger__chev${createExpanded ? ' is-open' : ''}`}>▼</span>
          </button>
          {createExpanded ? (
            <div className="pp-expandPanel">
              {!user ? (
                <p className="pp-subtle">
                  {t('lostPet.signInToPost')}{' '}
                  <Link className="pp-link" to="/login">
                    {t('nav.login')}
                  </Link>
                </p>
              ) : !pets.length ? (
                <p className="pp-subtle">
                  {t('lostPet.noPets')}{' '}
                  <Link className="pp-link" to="/pets">
                    {t('lostPet.introPets')}
                  </Link>
                </p>
              ) : (
                <form className="pp-form" onSubmit={onSubmit}>
                  <div>
                    <label className="pp-label" htmlFor={petSelectId}>
                      {t('lostPet.pet')}
                    </label>
                    <PrettySelect id={petSelectId} value={petId} onChange={(e) => setPetId(e.target.value)} required>
                      <option value="">{t('lostPet.selectPet')}</option>
                      {sortedPets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {getCategory(p.categoryId)?.emoji} {p.name}
                        </option>
                      ))}
                    </PrettySelect>
                  </div>
                  <MultiPhotoUpload photos={photoDrafts} onChange={setPhotoDrafts} disabled={submitting} hint={t('lostPet.photoHint')} />
                  <div>
                    <label className="pp-label">{t('lostPet.description')}</label>
                    <textarea className="pp-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
                  </div>
                  <div>
                    <label className="pp-label">{t('lostPet.identifyingMarks')}</label>
                    <textarea className="pp-input" rows={2} value={identifyingMarks} onChange={(e) => setIdentifyingMarks(e.target.value)} />
                  </div>
                  <div>
                    <label className="pp-label">{t('lostPet.lastSeen')}</label>
                    <textarea className="pp-input" rows={2} value={lastSeenText} onChange={(e) => setLastSeenText(e.target.value)} required />
                  </div>
                  <div className="pp-formRow">
                    <div>
                      <label className="pp-label">{t('lostPet.lastSeenAt')}</label>
                      <input className="pp-input" type="datetime-local" value={lastSeenAt} onChange={(e) => setLastSeenAt(e.target.value)} />
                    </div>
                  </div>
                  <div className="pp-formRow">
                    <div>
                      <label className="pp-label">{t('lostPet.lat')}</label>
                      <input className="pp-input" inputMode="decimal" value={lastSeenLat} onChange={(e) => setLastSeenLat(e.target.value)} />
                    </div>
                    <div>
                      <label className="pp-label">{t('lostPet.lng')}</label>
                      <input className="pp-input" inputMode="decimal" value={lastSeenLng} onChange={(e) => setLastSeenLng(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="pp-label">{t('lostPet.reward')}</label>
                    <input className="pp-input" value={reward} onChange={(e) => setReward(e.target.value)} />
                  </div>
                  <div>
                    <label className="pp-label">{t('lostPet.contactPhone')}</label>
                    <input className="pp-input" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
                  </div>
                  <div>
                    <label className="pp-label">{t('lostPet.additionalInfo')}</label>
                    <textarea className="pp-input" rows={2} value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} />
                  </div>
                  {formError ? <p className="pp-error">{formError}</p> : null}
                  <button className="pp-btn pp-btnPrimary" type="submit" disabled={submitting}>
                    {submitting ? t('common.saving') : t('lostPet.publish')}
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {myActiveAlerts.length ? (
        <div className="pp-col-12">
          <h2 className="pp-sectionTitle">{t('lostPet.yourAlerts')}</h2>
          <div className="pp-photoFeed">
            {myActiveAlerts.map((alert) => (
              <PhotoFeedCard
                key={alert.id}
                photoUrl={alert.primaryPhotoUrl}
                statusLabel={t('lostPet.statusLost')}
                statusTone="lost"
                title={alert.petName}
                subtitle={[lostPetSpeciesLabel(alert.categoryId, t), alert.breed].filter(Boolean).join(' · ')}
                metaLines={[
                  `${t('lostPet.lastSeenLabel')}: ${alert.lastSeenText}`,
                  alert.lastSeenAt ? formatWhen(alert.lastSeenAt) : '',
                ].filter(Boolean)}
                description={alert.description}
                detailHref={`/lost-pet/${alert.id}`}
                phone={alert.contactPhone}
                onShare={() =>
                  shareListing({
                    title: t('lostPet.shareTitle', { name: alert.petName }),
                    url: `${window.location.origin}/lost-pet/${alert.id}`,
                  })
                }
                secondaryAction={{
                  label: resolveBusy === alert.id ? t('common.saving') : t('lostPet.markFound'),
                  onClick: () => onMarkFound(alert.id),
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="pp-col-12">
        <h2 className="pp-sectionTitle">{t('lostPet.activeFeed')}</h2>
        {loading ? <p className="pp-subtle">{t('common.loading')}</p> : null}
        {feedError ? <p className="pp-error">{feedError}</p> : null}
        {!loading && !activeListings.length ? <p className="pp-subtle">{t('lostPet.emptyFeed')}</p> : null}
        <div className="pp-photoFeed">
          {activeListings
            .filter((a) => a.ownerUid !== uid)
            .map((alert) => (
              <PhotoFeedCard
                key={alert.id}
                photoUrl={alert.primaryPhotoUrl}
                statusLabel={t('lostPet.statusLost')}
                statusTone="lost"
                title={alert.petName}
                subtitle={[lostPetSpeciesLabel(alert.categoryId, t), alert.breed].filter(Boolean).join(' · ')}
                metaLines={[
                  `${t('lostPet.lastSeenLabel')}: ${alert.lastSeenText}`,
                  alert.lastSeenAt ? formatWhen(alert.lastSeenAt) : '',
                ].filter(Boolean)}
                description={alert.description}
                detailHref={`/lost-pet/${alert.id}`}
                phone={alert.contactPhone}
                onShare={() =>
                  shareListing({
                    title: t('lostPet.shareTitle', { name: alert.petName }),
                    url: `${window.location.origin}/lost-pet/${alert.id}`,
                  })
                }
              />
            ))}
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useId, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import PetAvatar from '../components/PetAvatar';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { usePets } from '../pets/PetsContext';
import { createBreedingListing, setBreedingListingStatus } from '../breeding/breedingFirestore';
import { isSampleBreedingListing } from '../breeding/sampleBreedingListings';
import { useBreedingListings } from '../breeding/useBreedingListings';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function BreedMatching() {
  const outletCtx = useOutletContext();
  const embedded = outletCtx?.embedded === true;
  const { user } = useAuth();
  const { t } = useI18n();
  const uid = user?.uid ?? '';
  const { pets } = usePets();
  const { activeFeed, mine, loading, error, backendOk } = useBreedingListings();

  const dogPets = useMemo(() => pets.filter((p) => p.categoryId === 'dog'), [pets]);
  const petLinkId = useId();
  const [linkedPetId, setLinkedPetId] = useState('');
  const [dogName, setDogName] = useState('');
  const [breedLabel, setBreedLabel] = useState('');
  const [gender, setGender] = useState(/** @type {'male'|'female'} */ ('male'));
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [formError, setFormError] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [manageBusy, setManageBusy] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [formExpanded, setFormExpanded] = useState(true);

  const pickPet = useCallback(
    (id) => {
      setLinkedPetId(id);
      const p = dogPets.find((x) => x.id === id);
      if (p) {
        setDogName(p.name || '');
        if (p.photoDataUrl) setPhotoPreview(p.photoDataUrl);
      }
    },
    [dogPets]
  );

  const onPickPhoto = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const s = typeof reader.result === 'string' ? reader.result : '';
        if (s.length > 380000) {
          setFormError(t('breeding.errPhotoBig'));
          return;
        }
        setPhotoPreview(s);
        setFormError('');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [t]
  );

  const filteredFeed = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return activeFeed.filter((row) => {
      if (genderFilter === 'male' && row.gender !== 'male') return false;
      if (genderFilter === 'female' && row.gender !== 'female') return false;
      if (!q) return true;
      const hay = `${row.dogName} ${row.breedLabel} ${row.description} ${row.locationText}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeFeed, searchQ, genderFilter]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!backendOk) {
      setFormError(t('breeding.errNoBackend'));
      return;
    }
    setSubmitBusy(true);
    try {
      const r = await createBreedingListing({
        uid,
        dogName,
        breedLabel,
        gender,
        description,
        locationText,
        contactPhone,
        contactEmail,
        linkedPetId: linkedPetId || undefined,
        photoDataUrl: photoPreview || undefined,
      });
      if (!r.ok) {
        if (r.reason === 'photo_too_large') setFormError(t('breeding.errPhotoBig'));
        else if (r.reason === 'required') setFormError(t('breeding.errRequired'));
        else setFormError(t('breeding.errGeneric'));
        return;
      }
      setDogName('');
      setBreedLabel('');
      setDescription('');
      setLocationText('');
      setContactPhone('');
      setContactEmail('');
      setPhotoPreview('');
      setLinkedPetId('');
      setFormExpanded(false);
    } finally {
      setSubmitBusy(false);
    }
  }

  async function onMarkStatus(id, status) {
    setManageBusy(id + status);
    setFormError('');
    try {
      await setBreedingListingStatus(id, uid, status);
    } catch {
      setFormError(t('breeding.errManage'));
    } finally {
      setManageBusy('');
    }
  }

  return (
    <div className="pp-grid">
      {!embedded ? (
        <div className="pp-col-12">
          <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="pp-badge pp-badge--premium">{t('breeding.badge')}</div>
              <h1 className="pp-h1" style={{ marginTop: 10 }}>
                {t('breeding.title')}
              </h1>
              <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 720 }}>
                {t('breeding.intro')}
              </p>
            </div>
            <Link className="pp-link" to="/dashboard">
              {t('breeding.backDash')}
            </Link>
          </div>
        </div>
      ) : null}

      {!backendOk ? (
        <div className="pp-col-12">
          <div className="pp-card pp-pad" style={{ borderColor: 'rgba(180, 100, 40, 0.35)' }}>
            <p className="pp-subtle" style={{ margin: 0 }}>
              {t('breeding.noBackend')}
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="pp-col-12">
          <p className="pp-subtle" style={{ color: 'var(--pp-danger, #b42318)', margin: 0 }}>
            {t('breeding.loadErr')}: {error}
          </p>
        </div>
      ) : null}

      <div className="pp-col-12 pp-col-md-5">
        <div className="pp-card pp-pad">
          <button
            type="button"
            className="pp-sectionTitle pp-link"
            style={{ width: '100%', textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
            aria-expanded={formExpanded}
            onClick={() => setFormExpanded((x) => !x)}
          >
            {formExpanded ? '▼ ' : '▶ '}
            {t('breeding.formHeading')}
          </button>
          {formExpanded ? (
            <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
              <p className="pp-subtle" style={{ fontSize: 13, marginBottom: 12 }}>
                {t('breeding.formHint')}
              </p>

              {dogPets.length > 0 ? (
                <>
                  <label className="pp-label" htmlFor={petLinkId}>
                    {t('breeding.fieldLinkPet')}
                  </label>
                  <select
                    id={petLinkId}
                    className="pp-input"
                    value={linkedPetId}
                    onChange={(e) => pickPet(e.target.value)}
                  >
                    <option value="">{t('breeding.linkPetNone')}</option>
                    {dogPets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('breeding.fieldDogName')}
              </label>
              <input className="pp-input" value={dogName} onChange={(e) => setDogName(e.target.value)} maxLength={80} />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('breeding.fieldBreed')}
              </label>
              <input className="pp-input" value={breedLabel} onChange={(e) => setBreedLabel(e.target.value)} maxLength={120} />

              <div className="pp-label" style={{ marginTop: 12 }}>
                {t('breeding.fieldGender')}
              </div>
              <div className="pp-community-walkStyle" style={{ marginTop: 6 }} role="group">
                <label>
                  <input type="radio" name="bg" checked={gender === 'male'} onChange={() => setGender('male')} />
                  {t('breeding.genderMale')}
                </label>
                <label>
                  <input type="radio" name="bg" checked={gender === 'female'} onChange={() => setGender('female')} />
                  {t('breeding.genderFemale')}
                </label>
              </div>

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('breeding.fieldDesc')}
              </label>
              <textarea className="pp-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('breeding.fieldLocation')}
              </label>
              <input className="pp-input" value={locationText} onChange={(e) => setLocationText(e.target.value)} />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('breeding.fieldPhone')}
              </label>
              <input className="pp-input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('breeding.fieldEmail')}
              </label>
              <input className="pp-input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('breeding.fieldPhoto')}
              </label>
              <input type="file" accept="image/*" onChange={onPickPhoto} />
              {photoPreview ? (
                <div style={{ marginTop: 10 }}>
                  <img src={photoPreview} alt="" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8 }} />
                </div>
              ) : null}

              {formError ? (
                <p className="pp-subtle" style={{ color: 'var(--pp-danger, #b42318)', marginTop: 12 }}>
                  {formError}
                </p>
              ) : null}

              <p style={{ marginTop: 16 }}>
                <button type="submit" className="pp-btn pp-btnPrimary" disabled={submitBusy || !backendOk}>
                  {submitBusy ? t('breeding.submitting') : t('breeding.submit')}
                </button>
              </p>
            </form>
          ) : null}
        </div>
      </div>

      <div className="pp-col-12 pp-col-md-7">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>
            {t('breeding.directoryTitle')}
          </h2>
          <p className="pp-subtle" style={{ marginBottom: 12 }}>
            {loading ? t('breeding.loading') : t('breeding.directoryHint')}
          </p>
          <div className="pp-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <input
              className="pp-input"
              style={{ flex: '1 1 200px', minWidth: 0 }}
              placeholder={t('breeding.searchPh')}
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            <select className="pp-input" style={{ maxWidth: 160 }} value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
              <option value="all">{t('breeding.filterAll')}</option>
              <option value="male">{t('breeding.filterMale')}</option>
              <option value="female">{t('breeding.filterFemale')}</option>
            </select>
          </div>

          {filteredFeed.length === 0 && !loading ? (
            <p className="pp-subtle">{t('breeding.empty')}</p>
          ) : (
            <ul className="pp-lostPetList" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredFeed.map((row) => (
                <li key={row.id} className="pp-card pp-pad" style={{ margin: 0 }}>
                  <div className="pp-row" style={{ gap: 14, alignItems: 'flex-start' }}>
                    <PetAvatar pet={{ categoryId: 'dog', photoDataUrl: row.photoDataUrl || undefined, name: row.dogName }} size={56} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pp-row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="pp-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong>{row.dogName}</strong>
                          <span className="pp-subtle">· {row.breedLabel}</span>
                          <span className="pp-badge" style={{ fontSize: 11 }}>
                            {row.gender === 'male' ? t('breeding.cardMale') : t('breeding.cardFemale')}
                          </span>
                          {isSampleBreedingListing(row.id) ? (
                            <span className="pp-badge" style={{ fontSize: 11, fontWeight: 600 }}>
                              {t('breeding.sampleBadge')}
                            </span>
                          ) : null}
                        </span>
                        <span className="pp-subtle" style={{ fontSize: 12 }}>
                          {formatWhen(row.createdAt)}
                        </span>
                      </div>
                      <p className="pp-subtle" style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>
                        {row.description}
                      </p>
                      <p className="pp-subtle" style={{ margin: '4px 0' }}>
                        <strong>{t('breeding.cardLocation')}</strong> {row.locationText}
                      </p>
                      {isSampleBreedingListing(row.id) ? (
                        <p style={{ marginTop: 10 }}>
                          <span className="pp-subtle">{t('breeding.cardContact')} </span>
                          <span>{row.contactPhone}</span>
                          {row.contactEmail ? (
                            <>
                              {' · '}
                              <span>{row.contactEmail}</span>
                            </>
                          ) : null}
                          <span className="pp-subtle" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                            {t('breeding.sampleContactNote')}
                          </span>
                        </p>
                      ) : (
                        <p style={{ marginTop: 10 }}>
                          <span className="pp-subtle">{t('breeding.cardContact')} </span>
                          <a className="pp-link" href={`tel:${row.contactPhone.replace(/\s/g, '')}`}>
                            {row.contactPhone}
                          </a>
                          {row.contactEmail ? (
                            <>
                              {' · '}
                              <a className="pp-link" href={`mailto:${row.contactEmail}`}>
                                {row.contactEmail}
                              </a>
                            </>
                          ) : null}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {mine.length > 0 ? (
          <div className="pp-card pp-pad" style={{ marginTop: 16 }}>
            <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>
              {t('breeding.mineTitle')}
            </h2>
            <ul className="pp-subtle" style={{ margin: 0, paddingLeft: 18 }}>
              {mine.map((row) => (
                <li key={row.id} style={{ marginBottom: 10 }}>
                  <strong>{row.dogName}</strong> —{' '}
                  {row.status === 'active'
                    ? t('breeding.stActive')
                    : row.status === 'paused'
                      ? t('breeding.stPaused')
                      : t('breeding.stMatched')}
                  {row.status === 'active' ? (
                    <>
                      {' '}
                      <button
                        type="button"
                        className="pp-link"
                        style={{ border: 0, background: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                        disabled={!!manageBusy}
                        onClick={() => onMarkStatus(row.id, 'matched')}
                      >
                        {manageBusy === `${row.id}matched` ? '…' : t('breeding.markMatched')}
                      </button>
                      {' · '}
                      <button
                        type="button"
                        className="pp-link"
                        style={{ border: 0, background: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                        disabled={!!manageBusy}
                        onClick={() => onMarkStatus(row.id, 'paused')}
                      >
                        {manageBusy === `${row.id}paused` ? '…' : t('breeding.pause')}
                      </button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

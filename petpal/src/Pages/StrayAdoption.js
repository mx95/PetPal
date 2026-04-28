import React, { useCallback, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PetAvatar from '../components/PetAvatar';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { PET_CATEGORIES } from '../pets/petCategories';
import { createStrayListing, setStrayListingStatus } from '../stray/strayFirestore';
import { isSampleStrayListing } from '../stray/sampleStrayListings';
import { useStrayListings } from '../stray/useStrayListings';

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function StrayAdoption() {
  const { user } = useAuth();
  const { t } = useI18n();
  const uid = user?.uid ?? '';
  const { availableFeed, mine, loading, error, backendOk } = useStrayListings();

  const petSelectId = useId();
  const [categoryId, setCategoryId] = useState('dog');
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [foundWhere, setFoundWhere] = useState('');
  const [foundWhenNote, setFoundWhenNote] = useState('');
  const [foundLat, setFoundLat] = useState('');
  const [foundLng, setFoundLng] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [formError, setFormError] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [manageBusy, setManageBusy] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [reportExpanded, setReportExpanded] = useState(true);

  const filteredFeed = useMemo(() => {
    if (filterCat === 'all') return availableFeed;
    return availableFeed.filter((x) => x.categoryId === filterCat);
  }, [availableFeed, filterCat]);

  const onPickPhoto = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      setPhotoPreview('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const s = typeof reader.result === 'string' ? reader.result : '';
      if (s.length > 380000) {
        setFormError(t('strayAdoption.errPhotoBig'));
        setPhotoPreview('');
        return;
      }
      setPhotoPreview(s);
      setFormError('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [t]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!backendOk) {
      setFormError(t('strayAdoption.errNoBackend'));
      return;
    }
    setSubmitBusy(true);
    try {
      const r = await createStrayListing({
        uid,
        categoryId,
        nickname,
        description,
        foundWhere,
        foundWhenNote,
        contactPhone,
        contactEmail,
        photoDataUrl: photoPreview || undefined,
        foundLat: foundLat.trim(),
        foundLng: foundLng.trim(),
      });
      if (!r.ok) {
        if (r.reason === 'photo_too_large') setFormError(t('strayAdoption.errPhotoBig'));
        else if (r.reason === 'required') setFormError(t('strayAdoption.errRequired'));
        else setFormError(t('strayAdoption.errGeneric'));
        return;
      }
      setNickname('');
      setDescription('');
      setFoundWhere('');
      setFoundWhenNote('');
      setFoundLat('');
      setFoundLng('');
      setContactPhone('');
      setContactEmail('');
      setPhotoPreview('');
      setReportExpanded(false);
    } finally {
      setSubmitBusy(false);
    }
  }

  async function onMarkStatus(id, status) {
    setManageBusy(id + status);
    setFormError('');
    try {
      await setStrayListingStatus(id, uid, status);
    } catch {
      setFormError(t('strayAdoption.errManage'));
    } finally {
      setManageBusy('');
    }
  }

  async function copyPhone(phone) {
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      // ignore
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="pp-badge">{t('strayAdoption.badge')}</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('strayAdoption.title')}
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 720 }}>
              {t('strayAdoption.intro')}
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            {t('strayAdoption.backDash')}
          </Link>
        </div>
      </div>

      {!backendOk ? (
        <div className="pp-col-12">
          <div className="pp-card pp-pad" style={{ borderColor: 'rgba(180, 100, 40, 0.35)' }}>
            <p className="pp-subtle" style={{ margin: 0 }}>
              {t('strayAdoption.noBackend')}
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="pp-col-12">
          <p className="pp-subtle" style={{ color: 'var(--pp-danger, #b42318)', margin: 0 }}>
            {t('strayAdoption.loadErr')}: {error}
          </p>
        </div>
      ) : null}

      <div className="pp-col-12 pp-col-md-5">
        <div className="pp-card pp-pad">
          <button
            type="button"
            className="pp-sectionTitle pp-link"
            style={{ width: '100%', textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
            aria-expanded={reportExpanded}
            onClick={() => setReportExpanded((x) => !x)}
          >
            {reportExpanded ? '▼ ' : '▶ '}
            {t('strayAdoption.reportHeading')}
          </button>
          {reportExpanded ? (
            <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
              <p className="pp-subtle" style={{ fontSize: 13, marginBottom: 12 }}>
                {t('strayAdoption.reportHint')}
              </p>

              <label className="pp-label" htmlFor={petSelectId}>
                {t('strayAdoption.fieldSpecies')}
              </label>
              <select id={petSelectId} className="pp-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {PET_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('strayAdoption.fieldNickname')}
              </label>
              <input className="pp-input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={120} />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('strayAdoption.fieldDesc')}
              </label>
              <textarea className="pp-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('strayAdoption.fieldFoundWhere')}
              </label>
              <input className="pp-input" value={foundWhere} onChange={(e) => setFoundWhere(e.target.value)} />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('strayAdoption.fieldFoundWhen')}
              </label>
              <input className="pp-input" value={foundWhenNote} onChange={(e) => setFoundWhenNote(e.target.value)} />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('strayAdoption.fieldCoords')}
              </label>
              <div className="pp-row" style={{ gap: 10 }}>
                <input
                  className="pp-input"
                  style={{ flex: 1 }}
                  placeholder={t('strayAdoption.latPh')}
                  value={foundLat}
                  onChange={(e) => setFoundLat(e.target.value)}
                />
                <input
                  className="pp-input"
                  style={{ flex: 1 }}
                  placeholder={t('strayAdoption.lngPh')}
                  value={foundLng}
                  onChange={(e) => setFoundLng(e.target.value)}
                />
              </div>

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('strayAdoption.fieldPhone')}
              </label>
              <input className="pp-input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('strayAdoption.fieldEmail')}
              </label>
              <input className="pp-input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />

              <label className="pp-label" style={{ marginTop: 12 }}>
                {t('strayAdoption.fieldPhoto')}
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
                  {submitBusy ? t('strayAdoption.submitting') : t('strayAdoption.submit')}
                </button>
              </p>
            </form>
          ) : null}
        </div>
      </div>

      <div className="pp-col-12 pp-col-md-7">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>
            {t('strayAdoption.boardTitle')}
          </h2>
          <p className="pp-subtle" style={{ marginBottom: 12 }}>
            {loading ? t('strayAdoption.loading') : t('strayAdoption.boardHint')}
          </p>
          <div className="pp-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={filterCat === 'all' ? 'pp-btn pp-btnPrimary' : 'pp-btn'}
              onClick={() => setFilterCat('all')}
            >
              {t('strayAdoption.filterAll')}
            </button>
            {PET_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={filterCat === c.id ? 'pp-btn pp-btnPrimary' : 'pp-btn'}
                onClick={() => setFilterCat(c.id)}
              >
                {c.emoji}
              </button>
            ))}
          </div>

          {filteredFeed.length === 0 && !loading ? (
            <p className="pp-subtle">{t('strayAdoption.empty')}</p>
          ) : (
            <ul className="pp-lostPetList" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredFeed.map((row) => (
                <li key={row.id} className="pp-card pp-pad" style={{ margin: 0 }}>
                  <div className="pp-row" style={{ gap: 14, alignItems: 'flex-start' }}>
                    <PetAvatar pet={{ categoryId: row.categoryId, photoDataUrl: row.photoDataUrl || undefined, name: row.nickname }} size={56} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pp-row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="pp-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong>{row.nickname}</strong>
                          {isSampleStrayListing(row.id) ? (
                            <span className="pp-badge" style={{ fontSize: 11, fontWeight: 600 }}>
                              {t('strayAdoption.sampleBadge')}
                            </span>
                          ) : null}
                        </span>
                        <span className="pp-subtle" style={{ fontSize: 12 }}>
                          {formatWhen(row.createdAt)}
                        </span>
                      </div>
                      <p className="pp-subtle" style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>
                        {row.description}
                      </p>
                      <p className="pp-subtle" style={{ margin: '4px 0' }}>
                        <strong>{t('strayAdoption.cardFound')}</strong> {row.foundWhere}
                      </p>
                      {row.foundWhenNote ? (
                        <p className="pp-subtle" style={{ margin: '4px 0' }}>
                          {row.foundWhenNote}
                        </p>
                      ) : null}
                      {row.foundLat != null && row.foundLng != null ? (
                        <p style={{ margin: '8px 0 0' }}>
                          <a className="pp-link" href={mapsLink(row.foundLat, row.foundLng)} target="_blank" rel="noreferrer">
                            {t('strayAdoption.openMap')}
                          </a>
                        </p>
                      ) : null}
                      {isSampleStrayListing(row.id) ? (
                        <p style={{ marginTop: 10 }}>
                          <span className="pp-subtle">{t('strayAdoption.cardContact')} </span>
                          <span>{row.contactPhone}</span>
                          {row.contactEmail ? (
                            <>
                              {' · '}
                              <span>{row.contactEmail}</span>
                            </>
                          ) : null}
                          <span className="pp-subtle" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                            {t('strayAdoption.sampleContactNote')}
                          </span>
                        </p>
                      ) : (
                        <p style={{ marginTop: 10 }}>
                          <span className="pp-subtle">{t('strayAdoption.cardContact')} </span>
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
                          <button
                            type="button"
                            className="pp-link"
                            style={{ marginLeft: 10, border: 0, background: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                            onClick={() => copyPhone(row.contactPhone)}
                          >
                            {t('strayAdoption.copyPhone')}
                          </button>
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
              {t('strayAdoption.mineTitle')}
            </h2>
            <ul className="pp-subtle" style={{ margin: 0, paddingLeft: 18 }}>
              {mine.map((row) => (
                <li key={row.id} style={{ marginBottom: 10 }}>
                  <strong>{row.nickname}</strong> —{' '}
                  {row.status === 'available'
                    ? t('strayAdoption.stAvailable')
                    : row.status === 'adopted'
                      ? t('strayAdoption.stAdopted')
                      : t('strayAdoption.stWithdrawn')}
                  {row.status === 'available' ? (
                    <>
                      {' '}
                      <button
                        type="button"
                        className="pp-link"
                        style={{ border: 0, background: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                        disabled={!!manageBusy}
                        onClick={() => onMarkStatus(row.id, 'adopted')}
                      >
                        {manageBusy === `${row.id}adopted` ? '…' : t('strayAdoption.markAdopted')}
                      </button>
                      {' · '}
                      <button
                        type="button"
                        className="pp-link"
                        style={{ border: 0, background: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                        disabled={!!manageBusy}
                        onClick={() => onMarkStatus(row.id, 'withdrawn')}
                      >
                        {manageBusy === `${row.id}withdrawn` ? '…' : t('strayAdoption.withdraw')}
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

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { applyMockAccountSeed, hasLoadedMockBundle } from '../data/mockAccountSeed';
import { PET_CATEGORIES } from '../pets/petCategories';
import { usePets } from '../pets/PetsContext';
import { filesToResizedDataUrls } from '../walk/walkPhotos';
import PetAvatar from '../components/PetAvatar';
import { PrettySelect } from '../components/PrettySelect';
import { useI18n } from '../i18n/I18nContext';
import { useToast } from '../components/Toast';
import ImeiQrScannerButton from '../components/ImeiQrScannerButton';

export default function MyPets() {
  const { t } = useI18n();
  const { show } = useToast();
  const location = useLocation();
  const { user } = useAuth();
  const { pets, addPet, updatePet, removePet, getCategory } = usePets();
  const [name, setName] = useState('');
  const [addDeviceId, setAddDeviceId] = useState('');
  const [colorScheme, setColorScheme] = useState('');
  const [description, setDescription] = useState('');
  const [age, setAge] = useState('');
  const [mockMsg, setMockMsg] = useState('');
  const [categoryId, setCategoryId] = useState('dog');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('dog');
  const [editDevice, setEditDevice] = useState('');
  const [editColorScheme, setEditColorScheme] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAge, setEditAge] = useState('');
  const [addPhotoBusy, setAddPhotoBusy] = useState(false);
  const [editPhotoBusy, setEditPhotoBusy] = useState(false);
  const [addPetExpanded, setAddPetExpanded] = useState(false);
  const addPhotoInputId = useId();
  const editPhotoInputId = useId();
  const addPhotoRef = useRef(null);
  const editPhotoRef = useRef(null);

  useEffect(() => {
    if (location.hash !== '#add-pet') return;
    setAddPetExpanded(true);
    const tmr = window.setTimeout(() => {
      document.getElementById('add-pet-expand')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(tmr);
  }, [location.hash]);

  const onScanImeiAdd = useCallback(
    (imei) => {
      setAddDeviceId(imei);
      show(t('myPets.scanQrSuccess'), { kind: 'success' });
    },
    [show, t]
  );

  const onScanImeiEdit = useCallback(
    (imei) => {
      setEditDevice(imei);
      show(t('myPets.scanQrSuccess'), { kind: 'success' });
    },
    [show, t]
  );

  async function submitAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    let photoDataUrl;
    const f = addPhotoRef.current?.files;
    if (f && f[0]) {
      setAddPhotoBusy(true);
      try {
        const urls = await filesToResizedDataUrls([f[0]]);
        photoDataUrl = urls[0];
      } catch {
        // skip bad file
      } finally {
        setAddPhotoBusy(false);
      }
    }
    addPet({
      name: name.trim(),
      categoryId,
      trackingDeviceId: addDeviceId.trim() || null,
      photoDataUrl,
      colorScheme,
      description,
      age,
    });
    setName('');
    setAddDeviceId('');
    setColorScheme('');
    setDescription('');
    setAge('');
    setCategoryId('dog');
    if (addPhotoRef.current) addPhotoRef.current.value = '';
    setAddPetExpanded(false);
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditCategoryId(p.categoryId);
    setEditDevice(p.trackingDeviceId || '');
    setEditColorScheme(p.colorScheme || '');
    setEditDescription(p.description || '');
    setEditAge(p.age || '');
    if (editPhotoRef.current) editPhotoRef.current.value = '';
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    let photoPatch = undefined;
    const f = editPhotoRef.current?.files;
    if (f && f[0]) {
      setEditPhotoBusy(true);
      try {
        const urls = await filesToResizedDataUrls([f[0]]);
        photoPatch = urls[0];
      } catch {
        // skip
      } finally {
        setEditPhotoBusy(false);
      }
    }
    updatePet(editingId, {
      name: editName,
      categoryId: editCategoryId,
      trackingDeviceId: editDevice.trim() || null,
      colorScheme: editColorScheme,
      description: editDescription,
      age: editAge,
      ...(photoPatch ? { photoDataUrl: photoPatch } : {}),
    });
    setEditingId(null);
    if (editPhotoRef.current) editPhotoRef.current.value = '';
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge">{t('myPets.badge')}</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('myPets.title')}
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 560 }}>
              {t('myPets.intro')}
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            {t('common.backDashboard')}
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad" style={{ borderColor: 'rgba(91, 55, 255, 0.2)' }}>
          <h2 className="pp-sectionTitle">{t('myPets.sampleTitle')}</h2>
          <p className="pp-subtle" style={{ marginBottom: 10, maxWidth: 720 }}>
            {t('myPets.sampleText')}
          </p>
          {!user ? (
            <p className="pp-subtle" style={{ color: '#b42318' }}>
              {t('myPets.sampleSignIn')}
            </p>
          ) : (
            <>
              {mockMsg ? <p className="pp-subtle" style={{ marginBottom: 10 }}>{mockMsg}</p> : null}
              {user?.uid && hasLoadedMockBundle(user.uid) ? (
                <p className="pp-subtle" style={{ fontSize: 12, marginBottom: 8 }}>
                  {t('myPets.sampleLoaded')}
                </p>
              ) : null}
              <button
                type="button"
                className="pp-btn pp-btnPrimary"
                onClick={() => {
                  setMockMsg('');
                  if (!user?.uid) return;
                  const r = applyMockAccountSeed(user.uid, user);
                  if (r.error === 'storage') {
                    setMockMsg(t('myPets.sampleStorageErr'));
                    return;
                  }
                  if (r.alreadyHadBundle) {
                    setMockMsg(t('myPets.sampleDone'));
                    return;
                  }
                  window.location.reload();
                }}
              >
                {t('myPets.sampleBtn')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <button
            type="button"
            className="pp-expandTrigger"
            aria-expanded={addPetExpanded}
            onClick={() => setAddPetExpanded((o) => !o)}
            id="add-pet-expand"
          >
            <span className="pp-expandTrigger__icon" aria-hidden>
              {addPetExpanded ? '−' : '+'}
            </span>
            <span className="pp-expandTrigger__text">
              <span className="pp-expandTrigger__title">{t('myPets.addTitle')}</span>
              <span className="pp-expandTrigger__desc">
                {addPetExpanded ? t('myPets.addExpandExpanded') : t('myPets.addExpandCollapsed')}
              </span>
            </span>
            <span className={`pp-expandTrigger__chev ${addPetExpanded ? 'is-open' : ''}`} aria-hidden>
              ▼
            </span>
          </button>
          {addPetExpanded ? (
            <div className="pp-expandPanel" role="region" aria-labelledby="add-pet-expand">
              <p className="pp-subtle pp-expandIntro">{t('myPets.introExpandPanel')}</p>
              <form className="pp-form" onSubmit={submitAdd}>
                <div>
                  <div className="pp-label">{t('myPets.name')}</div>
                  <input
                    className="pp-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('myPets.namePh')}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <div className="pp-label">{t('myPets.category')}</div>
                  <PrettySelect
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {PET_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {t(`categories.${c.id}`)}
                      </option>
                    ))}
                  </PrettySelect>
                </div>
                <div>
                  <div className="pp-label">{t('myPets.deviceId')}</div>
                  <div className="pp-row" style={{ alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      className="pp-input"
                      style={{ flex: '1 1 160px', minWidth: 0 }}
                      value={addDeviceId}
                      onChange={(e) => setAddDeviceId(e.target.value)}
                      placeholder={t('myPets.deviceIdPh')}
                      autoComplete="off"
                      inputMode="numeric"
                    />
                    <ImeiQrScannerButton onImei={onScanImeiAdd} disabled={addPhotoBusy} />
                  </div>
                </div>
                <div>
                  <div className="pp-label">{t('myPets.color')}</div>
                  <input
                    className="pp-input"
                    value={colorScheme}
                    onChange={(e) => setColorScheme(e.target.value)}
                    maxLength={120}
                    placeholder={t('myPets.colorPh')}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <div className="pp-label">{t('myPets.age')}</div>
                  <input
                    className="pp-input"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    maxLength={80}
                    placeholder={t('myPets.agePh')}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <div className="pp-label">{t('myPets.description')}</div>
                  <textarea
                    className="pp-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                    style={{ minHeight: 72, resize: 'vertical' }}
                    placeholder={t('myPets.descPh')}
                  />
                </div>
                <div>
                  <div className="pp-label">{t('myPets.photo')}</div>
                  <input
                    id={addPhotoInputId}
                    ref={addPhotoRef}
                    type="file"
                    accept="image/*"
                    className="pp-input"
                    style={{ fontSize: 14 }}
                  />
                  <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                    {t('myPets.photoHint')}
                  </p>
                </div>
                <button type="submit" className="pp-btn pp-btnPrimary" disabled={!name.trim() || addPhotoBusy}>
                  {addPhotoBusy ? t('myPets.processing') : t('myPets.addPet')}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">{t('myPets.yourPackCount', { count: pets.length })}</h2>
          {pets.length === 0 ? (
            <p className="pp-subtle">{t('myPets.noPets')}</p>
          ) : (
            <ul className="pp-petList">
              {pets.map((p) => (
                <li key={p.id} className="pp-petList__item">
                  {editingId === p.id ? (
                    <form className="pp-form" onSubmit={saveEdit}>
                      <div className="pp-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 140px' }}>
                          <div className="pp-label">{t('myPets.name')}</div>
                          <input
                            className="pp-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>
                        <div style={{ flex: '1 1 160px' }}>
                          <div className="pp-label">{t('myPets.category')}</div>
                          <PrettySelect value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                            {PET_CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.emoji} {t(`categories.${c.id}`)}
                              </option>
                            ))}
                          </PrettySelect>
                        </div>
                      </div>
                      <div>
                        <div className="pp-label">{t('myPets.color')}</div>
                        <input
                          className="pp-input"
                          value={editColorScheme}
                          onChange={(e) => setEditColorScheme(e.target.value)}
                          maxLength={120}
                          placeholder={t('myPets.colorPh')}
                        />
                      </div>
                      <div>
                        <div className="pp-label">{t('myPets.age')}</div>
                        <input
                          className="pp-input"
                          value={editAge}
                          onChange={(e) => setEditAge(e.target.value)}
                          maxLength={80}
                          placeholder={t('myPets.agePh')}
                        />
                      </div>
                      <div>
                        <div className="pp-label">{t('myPets.description')}</div>
                        <textarea
                          className="pp-input"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          maxLength={2000}
                          style={{ minHeight: 72, resize: 'vertical' }}
                          placeholder={t('myPets.shortNotes')}
                        />
                      </div>
                      <div>
                        <div className="pp-label">{t('myPets.deviceId')}</div>
                        <div className="pp-row" style={{ alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
                          <input
                            className="pp-input"
                            style={{ flex: '1 1 160px', minWidth: 0 }}
                            value={editDevice}
                            onChange={(e) => setEditDevice(e.target.value)}
                            placeholder={t('myPets.deviceIdPh')}
                            inputMode="numeric"
                          />
                          <ImeiQrScannerButton onImei={onScanImeiEdit} disabled={editPhotoBusy} />
                        </div>
                      </div>
                      <div>
                        <div className="pp-label">{t('myPets.profilePhoto')}</div>
                        <div className="pp-row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {p.photoDataUrl ? (
                            <img
                              src={p.photoDataUrl}
                              alt=""
                              className="pp-petAvatar"
                              style={{ width: 56, height: 56 }}
                            />
                          ) : (
                            <div
                              className="pp-petAvatar pp-petAvatar--placeholder"
                              style={{ width: 56, height: 56, fontSize: 28 }}
                              aria-hidden
                            >
                              {getCategory(p).emoji}
                            </div>
                          )}
                          <div style={{ flex: '1 1 200px' }}>
                            <input
                              id={editPhotoInputId}
                              ref={editPhotoRef}
                              type="file"
                              accept="image/*"
                              className="pp-input"
                              style={{ fontSize: 14 }}
                            />
                            {p.photoDataUrl ? (
                              <button
                                type="button"
                                className="pp-link"
                                style={{ display: 'block', marginTop: 6, padding: 0, fontSize: 12 }}
                                onClick={() => {
                                  updatePet(editingId, { photoDataUrl: null });
                                }}
                              >
                                {t('myPets.removePhoto')}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="pp-row" style={{ gap: 8 }}>
                        <button type="submit" className="pp-btn pp-btnPrimary" disabled={editPhotoBusy}>
                          {editPhotoBusy ? t('myPets.processing') : t('common.save')}
                        </button>
                        <button type="button" className="pp-btn" onClick={() => setEditingId(null)}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="pp-petList__row">
                        <PetAvatar pet={p} size={48} />
                        <div>
                          <div className="pp-petList__name">{p.name}</div>
                          <div className="pp-petList__meta">
                            {t(`categories.${getCategory(p).id}`)}
                            {p.trackingDeviceId ? (
                              <>
                                {' '}
                                · {t('myPets.listDevice')}
                                {p.trackingDeviceId}
                              </>
                            ) : (
                              <>
                                {' '}
                                · {t('myPets.noTracker')}
                              </>
                            )}
                          </div>
                          {(p.age || p.colorScheme) && (
                            <div className="pp-petList__tags">
                              {p.age ? (
                                <span className="pp-petTag">
                                  {t('myPets.tagAge')} {p.age}
                                </span>
                              ) : null}
                              {p.colorScheme ? (
                                <span className="pp-petTag">
                                  {t('myPets.tagLook')} {p.colorScheme}
                                </span>
                              ) : null}
                            </div>
                          )}
                          {p.description ? (
                            <p className="pp-petList__desc">{p.description}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="pp-row" style={{ marginTop: 10, gap: 8 }}>
                        <button type="button" className="pp-btn" onClick={() => startEdit(p)}>
                          {t('myPets.edit')}
                        </button>
                        <button
                          type="button"
                          className="pp-btn"
                          onClick={() => {
                            if (window.confirm(t('myPets.removeConfirm', { name: p.name }))) removePet(p.id);
                          }}
                        >
                          {t('myPets.remove')}
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

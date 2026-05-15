import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { getDb, isFirebaseConfigured } from '../firebase';
import { PET_CATEGORIES } from '../pets/petCategories';
import { usePets } from '../pets/PetsContext';
import { deletePetPhoto, deletePetPhotoByPath, uploadPetPhoto } from '../pets/petPhotoStorage';
import PetAvatar from '../components/PetAvatar';
import { PrettySelect } from '../components/PrettySelect';
import { useI18n } from '../i18n/I18nContext';
import { useToast } from '../components/Toast';
import ImeiQrScannerButton from '../components/ImeiQrScannerButton';
import PetMedicationModal from '../components/PetMedicationModal';
import IconMedPill from '../components/icons/IconMedPill';

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}

export default function MyPets() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { show } = useToast();
  const location = useLocation();
  const { pets, addPet, updatePet, removePet, getCategory } = usePets();
  const [name, setName] = useState('');
  const [addDeviceId, setAddDeviceId] = useState('');
  const [breed, setBreed] = useState('');
  const [microchipNo, setMicrochipNo] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [colorScheme, setColorScheme] = useState('');
  const [identifyingMarks, setIdentifyingMarks] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [accountType, setAccountType] = useState('individual');
  const [friendlyWith, setFriendlyWith] = useState({ dogs: false, cats: false, people: false, children: false });
  const [categoryId, setCategoryId] = useState('dog');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('dog');
  const [editDevice, setEditDevice] = useState('');
  const [editBreed, setEditBreed] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editMicrochipNo, setEditMicrochipNo] = useState('');
  const [editColorScheme, setEditColorScheme] = useState('');
  const [editIdentifyingMarks, setEditIdentifyingMarks] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFriendlyWith, setEditFriendlyWith] = useState({ dogs: false, cats: false, people: false, children: false });
  const [addPhotoBusy, setAddPhotoBusy] = useState(false);
  const [editPhotoBusy, setEditPhotoBusy] = useState(false);
  const [addPetDrawerOpen, setAddPetDrawerOpen] = useState(false);
  const [fullscreenPhotoUrl, setFullscreenPhotoUrl] = useState('');
  const [medModalPet, setMedModalPet] = useState(null);
  const [search, setSearch] = useState('');
  const importRef = useRef(null);
  const addPhotoInputId = useId();
  const editPhotoInputId = useId();
  const addPhotoRef = useRef(null);
  const editPhotoRef = useRef(null);

  const filteredPets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pets;
    return pets.filter((p) => {
      const c = getCategory(p);
      return [p.name, p.breed, p.microchipNo, p.trackingDeviceId, c.id]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    });
  }, [pets, search, getCategory]);

  function exportCsv() {
    const headers = ['species', 'name', 'breed', 'microchip', 'trackingDeviceId', 'nfcTag', 'linkedTracker'];
    const rows = pets.map((p) => {
      const species = getCategory(p).id;
      return [species, p.name || '', p.breed || '', p.microchipNo || '', p.trackingDeviceId || '', p.nfcTag ? 'true' : 'false', p.linkedTracker ? 'true' : 'false'];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'petpal-pets.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (lines.length < 2) return;
    const parseLine = (line) => line.split(',').map((v) => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
    const headers = parseLine(lines[0]);
    for (const line of lines.slice(1)) {
      const cols = parseLine(line);
      const row = Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
      const species = String(row.species || 'dog').toLowerCase();
      const category = PET_CATEGORIES.some((c) => c.id === species) ? species : 'dog';
      await addPet({
        name: row.name || 'Pet',
        categoryId: category,
        breed: row.breed || 'Unknown',
        dateOfBirth: row.dateOfBirth || '2000-01-01',
        colorScheme: row.colorScheme || 'N/A',
        microchipNo: row.microchip || '',
        trackingDeviceId: row.trackingDeviceId || null,
        nfcTag: String(row.nfcTag).toLowerCase() === 'true',
      });
    }
  }

  useEffect(() => {
    if (location.hash !== '#add-pet') return;
    setAddPetDrawerOpen(true);
    const tmr = window.setTimeout(() => {
      document.getElementById('add-pet-open')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(tmr);
  }, [location.hash]);

  useEffect(() => {
    if (!addPetDrawerOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setAddPetDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [addPetDrawerOpen]);

  useEffect(() => {
    // Prevent iOS/Android "page drag" behind the modal.
    const cls = 'pp-noScroll';
    if (addPetDrawerOpen) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [addPetDrawerOpen]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!user?.uid || !isFirebaseConfigured()) {
        if (!cancelled) {
          setAccountType('individual');
          setOwnerEmail(user?.email || '');
          setOwnerName(user?.displayName || '');
          setOwnerPhone('');
        }
        return;
      }
      try {
        const snap = await getDoc(doc(getDb(), 'users', user.uid));
        const data = snap.exists() ? snap.data() : {};
        if (cancelled) return;
        const accType = String(data.accountType || 'individual').toLowerCase();
        const f = String(data.firstName || '').trim();
        const l = String(data.lastName || '').trim();
        const full = [l, f].filter(Boolean).join(' ').trim();
        setAccountType(accType);
        setOwnerName(full || String(data.accountName || '').trim() || user.displayName || '');
        setOwnerPhone(String(data.phone || '').trim());
        setOwnerEmail(String(data.email || '').trim() || user.email || '');
      } catch {
        if (cancelled) return;
        setAccountType('individual');
        setOwnerName(user?.displayName || '');
        setOwnerPhone('');
        setOwnerEmail(user?.email || '');
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
    if (!name.trim() || !breed.trim() || !dateOfBirth || !colorScheme.trim()) return;
    const createdPetId = await addPet({
      name: name.trim(),
      categoryId,
      trackingDeviceId: addDeviceId.trim() || null,
      breed,
      microchipNo,
      dateOfBirth,
      colorScheme,
      identifyingMarks,
      medicalNotes,
      ownerName: accountType === 'vet' ? ownerName : ownerName,
      ownerPhone: accountType === 'vet' ? ownerPhone : ownerPhone,
      ownerEmail: accountType === 'vet' ? ownerEmail : ownerEmail,
      nfcTag: false,
      friendlyWith: Object.entries(friendlyWith)
        .filter(([, v]) => !!v)
        .map(([k]) => k),
    });

    const f = addPhotoRef.current?.files;
    if (createdPetId && f && f[0] && user?.uid) {
      setAddPhotoBusy(true);
      try {
        const photoUpload = await uploadPetPhoto({ uid: user.uid, file: f[0], petId: createdPetId });
        if (photoUpload) {
          updatePet(createdPetId, {
            photoUrl: photoUpload.photoUrl,
            photoStoragePath: photoUpload.photoStoragePath,
            photoDataUrl: null,
          });
        }
      } catch {
        // keep flow resilient even if storage upload fails
      } finally {
        setAddPhotoBusy(false);
      }
    }
    setName('');
    setBreed('');
    setMicrochipNo('');
    setDateOfBirth('');
    setAddDeviceId('');
    setColorScheme('');
    setIdentifyingMarks('');
    setMedicalNotes('');
    setFriendlyWith({ dogs: false, cats: false, people: false, children: false });
    setCategoryId('dog');
    if (addPhotoRef.current) addPhotoRef.current.value = '';
    setAddPetDrawerOpen(false);
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditCategoryId(p.categoryId);
    setEditDevice(p.trackingDeviceId || '');
    setEditBreed(p.breed || '');
    setEditDateOfBirth(p.dateOfBirth || '');
    setEditMicrochipNo(p.microchipNo || '');
    setEditColorScheme(p.colorScheme || '');
    setEditIdentifyingMarks(p.identifyingMarks || '');
    setEditDescription(p.description || '');
    const setFrom = Array.isArray(p.friendlyWith) ? p.friendlyWith : [];
    setEditFriendlyWith({
      dogs: setFrom.includes('dogs'),
      cats: setFrom.includes('cats'),
      people: setFrom.includes('people'),
      children: setFrom.includes('children'),
    });
    if (editPhotoRef.current) editPhotoRef.current.value = '';
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    const currentPet = pets.find((p) => p.id === editingId);
    const prevImei = (currentPet?.trackingDeviceId || '').trim();
    const nextImei = editDevice.trim();
    if (prevImei && nextImei && nextImei !== prevImei) {
      if (!window.confirm(t('trackingPage.imeiConfirmChange', { from: prevImei, to: nextImei }))) return;
    }
    if (prevImei && !nextImei) {
      if (!window.confirm(t('trackingPage.imeiConfirmClear'))) return;
    }
    let photoPatch = undefined;
    const f = editPhotoRef.current?.files;
    if (f && f[0] && user?.uid) {
      setEditPhotoBusy(true);
      try {
        const upload = await uploadPetPhoto({ uid: user.uid, file: f[0], petId: editingId });
        if (upload) {
          photoPatch = upload;
          if (currentPet?.photoStoragePath) {
            await deletePetPhotoByPath(currentPet.photoStoragePath);
          }
        }
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
      breed: editBreed,
      dateOfBirth: editDateOfBirth,
      microchipNo: editMicrochipNo,
      colorScheme: editColorScheme,
      identifyingMarks: editIdentifyingMarks,
      description: editDescription,
      friendlyWith: Object.entries(editFriendlyWith)
        .filter(([, v]) => !!v)
        .map(([k]) => k),
      ...(photoPatch
        ? { photoUrl: photoPatch.photoUrl, photoStoragePath: photoPatch.photoStoragePath, photoDataUrl: null }
        : {}),
    });
    setEditingId(null);
    if (editPhotoRef.current) editPhotoRef.current.value = '';
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div>
          <div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('myPets.title')}
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6 }}>
              {t('myPets.intro')}
            </p>
          </div>
        </div>
        <div className="pp-row" style={{ marginTop: 12 }}>
          <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="pp-petSearchBox">
              <IconSearch />
              <input
                className="pp-input"
                style={{
                  border: 0,
                  boxShadow: 'none',
                  padding: '6px 0 7px',
                  minWidth: 140,
                  background: 'transparent',
                  borderRadius: 0,
                  fontWeight: 400,
                  letterSpacing: 'normal',
                  textTransform: 'none',
                  lineHeight: 'normal',
                  height: 'auto',
                  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                }}
                placeholder="Search pets"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <input
              ref={importRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await importCsv(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="pp-btn pp-tooltipBtn"
              data-tooltip={t('myPets.importCsv')}
              aria-label={t('myPets.importCsv')}
              onClick={() => importRef.current?.click()}
            >
              <IconUpload />
            </button>
            <button
              type="button"
              className="pp-btn pp-tooltipBtn"
              data-tooltip={t('myPets.exportCsv')}
              aria-label={t('myPets.exportCsv')}
              onClick={exportCsv}
            >
              <IconDownload />
            </button>
          </div>
          <button
            id="add-pet-open"
            type="button"
            className="pp-btn pp-btnPrimary"
            onClick={() => setAddPetDrawerOpen(true)}
            style={{ marginLeft: 'auto' }}
          >
            + {t('myPets.addTitle')}
          </button>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">{t('myPets.yourPackCount', { count: pets.length })}</h2>
          {pets.length === 0 ? (
            <p className="pp-subtle">{t('myPets.noPets')}</p>
          ) : (
            <ul className="pp-petList">
              {filteredPets.map((p) => (
                <li key={p.id} className="pp-petList__item">
                  {editingId === p.id ? (
                    <form className="pp-form" onSubmit={saveEdit}>
                      <div className="pp-modalGrid2">
                        <div>
                          <div className="pp-label">Category *</div>
                          <PrettySelect value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                            {PET_CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.emoji} {t(`categories.${c.id}`)}
                              </option>
                            ))}
                          </PrettySelect>
                        </div>
                        <div>
                          <div className="pp-label">Name *</div>
                          <input className="pp-input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                        </div>
                      </div>

                      <div className="pp-modalGrid2">
                        <div>
                          <div className="pp-label">Breed *</div>
                          <input className="pp-input" value={editBreed} onChange={(e) => setEditBreed(e.target.value)} required />
                        </div>
                        <div>
                          <div className="pp-label">Date of birth *</div>
                          <input
                            className="pp-input"
                            type="date"
                            value={editDateOfBirth}
                            onChange={(e) => setEditDateOfBirth(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="pp-modalGrid2">
                        <div>
                          <div className="pp-label">Color *</div>
                          <input
                            className="pp-input"
                            value={editColorScheme}
                            onChange={(e) => setEditColorScheme(e.target.value)}
                            maxLength={120}
                            placeholder={t('myPets.colorPh')}
                            required
                          />
                        </div>
                        <div>
                          <div className="pp-label">Identifying Marks</div>
                          <input
                            className="pp-input"
                            value={editIdentifyingMarks}
                            onChange={(e) => setEditIdentifyingMarks(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="pp-modalGrid2">
                        <div>
                          <div className="pp-label">GPS device ID</div>
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
                          <div className="pp-label">Microchip No.</div>
                          <input className="pp-input" value={editMicrochipNo} onChange={(e) => setEditMicrochipNo(e.target.value)} />
                        </div>
                      </div>

                      <div>
                        <div className="pp-label">Medical notes</div>
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
                        <div className="pp-label">Friendly with</div>
                        <p className="pp-subtle" style={{ fontSize: 12, marginTop: 0, marginBottom: 6 }}>
                          Select where this pet is comfortable and social.
                        </p>
                        <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                          {[
                            ['dogs', 'Dogs'],
                            ['cats', 'Cats'],
                            ['people', 'People'],
                            ['children', 'Children'],
                          ].map(([key, label]) => (
                            <label key={key} className="pp-chipCheck">
                              <input
                                type="checkbox"
                                checked={editFriendlyWith[key]}
                                onChange={(e) => setEditFriendlyWith((s) => ({ ...s, [key]: e.target.checked }))}
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="pp-label">{t('myPets.profilePhoto')}</div>
                        <div className="pp-row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {p.photoUrl || p.photoDataUrl ? (
                            <img
                              src={p.photoUrl || p.photoDataUrl}
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
                            {p.photoUrl || p.photoDataUrl ? (
                              <button
                                type="button"
                                className="pp-link"
                                style={{ display: 'block', marginTop: 6, padding: 0, fontSize: 12 }}
                                onClick={async () => {
                                  await deletePetPhoto({ photoStoragePath: p.photoStoragePath, photoUrl: p.photoUrl });
                                  updatePet(editingId, { photoUrl: null, photoStoragePath: null, photoDataUrl: null });
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
                      <div className="pp-petList__row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => setFullscreenPhotoUrl(p.photoUrl || p.photoDataUrl || '')}
                            style={{ border: 0, padding: 0, background: 'transparent', cursor: p.photoUrl || p.photoDataUrl ? 'zoom-in' : 'default' }}
                            aria-label={p.photoUrl || p.photoDataUrl ? 'Open photo fullscreen' : 'No photo'}
                            disabled={!p.photoUrl && !p.photoDataUrl}
                          >
                            <PetAvatar pet={p} size={56} />
                          </button>
                          <div style={{ minWidth: 0 }}>
                            <div className="pp-petList__name">{getCategory(p).emoji} {p.name}</div>
                            <div className="pp-petList__tags" style={{ marginTop: 8 }}>
                              <span
                                className="pp-petTag"
                                style={{
                                  borderColor: p.linkedTracker ? 'rgba(22,163,74,.45)' : 'rgba(220,38,38,.45)',
                                  background: p.linkedTracker ? 'rgba(22,163,74,.10)' : 'rgba(220,38,38,.10)',
                                  color: p.linkedTracker ? '#166534' : '#991b1b',
                                }}
                              >
                                Linked Tracker: {p.linkedTracker ? 'Yes' : 'No'}
                              </span>
                              <span
                                className="pp-petTag"
                                style={{
                                  borderColor: p.nfcTag ? 'rgba(22,163,74,.45)' : 'rgba(220,38,38,.45)',
                                  background: p.nfcTag ? 'rgba(22,163,74,.10)' : 'rgba(220,38,38,.10)',
                                  color: p.nfcTag ? '#166534' : '#991b1b',
                                }}
                              >
                                NFC Tag: {p.nfcTag ? 'Yes' : 'No'}
                              </span>
                            </div>

                            {p.microchipNo ? (
                              <div className="pp-petList__meta" style={{ marginTop: 8 }}>
                                <strong>Microchip:</strong> {p.microchipNo}
                              </div>
                            ) : null}
                            {p.breed ? (
                              <div className="pp-petList__meta" style={{ marginTop: 4 }}>
                                <strong>Breed:</strong> {p.breed}
                              </div>
                            ) : null}

                            {p.description ? (
                              <p className="pp-petList__desc">{p.description}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="pp-petActions" style={{ marginLeft: 12 }}>
                          <button
                            type="button"
                            className="pp-btn pp-iconBtn pp-iconBtn--outline pp-tooltipBtn"
                            data-tooltip={t('myPets.viewPublicProfile')}
                            onClick={() => {
                              const publicId = p.publicProfileId || p.id;
                              window.location.href = `/pet/${encodeURIComponent(publicId)}`;
                            }}
                            aria-label={t('myPets.viewPublicProfile')}
                          >
                            <IconEye />
                          </button>
                          <button
                            type="button"
                            className="pp-btn pp-iconBtn pp-iconBtn--outline pp-tooltipBtn"
                            data-tooltip={t('myPets.edit')}
                            onClick={() => startEdit(p)}
                            aria-label={t('myPets.edit')}
                          >
                            <IconPencil />
                          </button>
                          <button
                            type="button"
                            className="pp-btn pp-iconBtn pp-iconBtn--outline pp-iconBtn--danger pp-tooltipBtn"
                            data-tooltip={t('myPets.remove')}
                            aria-label={t('myPets.remove')}
                            onClick={async () => {
                              if (!window.confirm(t('myPets.removeConfirm', { name: p.name }))) return;
                              await deletePetPhoto({ photoStoragePath: p.photoStoragePath, photoUrl: p.photoUrl });
                              removePet(p.id);
                            }}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                      {p.trackingDeviceId ? (
                        <div className="pp-petList__meta" style={{ marginTop: 8 }}>
                          {t('myPets.listDevice')} {p.trackingDeviceId}
                        </div>
                      ) : null}
                      <div className="pp-petList__medRow">
                        <button
                          type="button"
                          className="pp-btn pp-iconBtn pp-iconBtn--outline pp-tooltipBtn"
                          data-tooltip={t('myPets.medsOpen')}
                          onClick={() => setMedModalPet(p)}
                          aria-label={t('myPets.medsOpen')}
                        >
                          <IconMedPill />
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

      {addPetDrawerOpen ? (
        <div className="pp-modalWrap" role="dialog" aria-modal="true" aria-labelledby="add-pet-title">
          <button
            type="button"
            className="pp-modalBackdrop"
            aria-label={t('common.cancel')}
            onClick={() => setAddPetDrawerOpen(false)}
          />
          <div className="pp-modalCard pp-modalCard--petAdd">
            <div className="pp-modalHead">
              <div>
                <h2 id="add-pet-title" className="pp-sectionTitle" style={{ margin: 0 }}>
                  {t('myPets.addTitle')}
                </h2>
                <p className="pp-subtle" style={{ margin: '6px 0 0' }}>Fill in pet details and upload profile picture.</p>
              </div>
              <button
                type="button"
                className="pp-btn"
                onClick={() => setAddPetDrawerOpen(false)}
                aria-label={t('common.cancel')}
                title={t('common.cancel')}
              >
                ✕
              </button>
            </div>

            <form className="pp-form pp-modalForm" onSubmit={submitAdd}>
              <div className="pp-modalGrid2">
                <div>
                  <div className="pp-label">Category *</div>
                  <PrettySelect value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    {PET_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {t(`categories.${c.id}`)}
                      </option>
                    ))}
                  </PrettySelect>
                </div>
                <div>
                  <div className="pp-label">Name *</div>
                  <input
                    className="pp-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('myPets.namePh')}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </div>

              <div className="pp-modalGrid2">
                <div>
                  <div className="pp-label">Breed *</div>
                  <input className="pp-input" value={breed} onChange={(e) => setBreed(e.target.value)} required />
                </div>
                <div>
                  <div className="pp-label">Date of birth *</div>
                  <input className="pp-input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
                </div>
              </div>

              <div className="pp-modalGrid2">
                <div>
                  <div className="pp-label">Color *</div>
                  <input
                    className="pp-input"
                    value={colorScheme}
                    onChange={(e) => setColorScheme(e.target.value)}
                    maxLength={120}
                    placeholder={t('myPets.colorPh')}
                    autoComplete="off"
                    required
                  />
                </div>
                <div>
                  <div className="pp-label">Identifying Marks</div>
                  <input className="pp-input" value={identifyingMarks} onChange={(e) => setIdentifyingMarks(e.target.value)} />
                </div>
              </div>

              <div className="pp-modalGrid2">
                <div>
                  <div className="pp-label">GPS device ID</div>
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
                  <div className="pp-label">Microchip No.</div>
                  <input className="pp-input" value={microchipNo} onChange={(e) => setMicrochipNo(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="pp-label">Medical notes</div>
                <textarea
                  className="pp-input"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  maxLength={2000}
                  style={{ minHeight: 80, resize: 'vertical' }}
                />
              </div>

              {accountType === 'vet' ? (
                <div className="pp-modalGrid2">
                  <div>
                    <div className="pp-label">Owner name</div>
                    <input className="pp-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                  </div>
                  <div>
                    <div className="pp-label">Owner phone</div>
                    <input className="pp-input" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
                  </div>
                  <div>
                    <div className="pp-label">Owner email</div>
                    <input className="pp-input" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
                  </div>
                </div>
              ) : null}

              <div>
                <div className="pp-label">Friendly with</div>
                <p className="pp-subtle" style={{ fontSize: 12, marginTop: 0, marginBottom: 6 }}>
                  Select where this pet is comfortable and social.
                </p>
                <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {[
                    ['dogs', 'Dogs'],
                    ['cats', 'Cats'],
                    ['people', 'People'],
                    ['children', 'Children'],
                  ].map(([key, label]) => (
                    <label key={key} className="pp-chipCheck">
                      <input
                        type="checkbox"
                        checked={friendlyWith[key]}
                        onChange={(e) => setFriendlyWith((s) => ({ ...s, [key]: e.target.checked }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
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
              </div>

              <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                {t('myPets.photoHint')}
              </p>

              <div className="pp-modalActions">
                <button type="button" className="pp-btn" onClick={() => setAddPetDrawerOpen(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="pp-btn pp-btnPrimary"
                  disabled={!name.trim() || !breed.trim() || !dateOfBirth || !colorScheme.trim() || addPhotoBusy}
                >
                  {addPhotoBusy ? t('myPets.processing') : t('myPets.addPet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {medModalPet ? (
        <PetMedicationModal
          open
          onClose={() => setMedModalPet(null)}
          mode="owner"
          petName={medModalPet.name}
          ownerUid={user?.uid || null}
          petId={medModalPet.id}
        />
      ) : null}

      {fullscreenPhotoUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pet photo full screen"
          style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.94)', display: 'grid', placeItems: 'center', padding: 16 }}
        >
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              className="pp-btn"
              onClick={() => setFullscreenPhotoUrl('')}
              aria-label="Close"
              title="Close"
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 36,
                height: 36,
                padding: 0,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.25)',
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
            <img src={fullscreenPhotoUrl} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain' }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

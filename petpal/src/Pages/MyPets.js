import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { sharePetWithEmail } from '../pets/petShareFirestore';
import { linkPetTrackerImei } from '../tracking/linkPetTrackerImei';
import { fetchRegisteredTrackerImeis } from '../tracking/registeredDeviceClient';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51 15.42 17.49" />
      <path d="M15.41 6.51 8.59 10.49" />
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

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconSignal() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 14.5a8.5 8.5 0 0 1 15 0" />
      <path d="M7.5 17a4.5 4.5 0 0 1 9 0" />
      <circle cx="12" cy="20" r="1" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

function IconPaw() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="8" r="1.8" />
      <circle cx="12" cy="5.8" r="1.8" />
      <circle cx="17" cy="8" r="1.8" />
      <path d="M8.5 14c0-2 1.5-3.2 3.5-3.2s3.5 1.2 3.5 3.2c0 2.2-1.4 3.8-3.5 3.8S8.5 16.2 8.5 14z" />
    </svg>
  );
}

function IconMoreAbout() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" />
      <path d="M9 9h6M9 13h6" />
    </svg>
  );
}

/** Solid green circle + white tick (NFC active / enabled states). */
function IconGreenTick({ size = 28, soft = false }) {
  if (soft) {
    return (
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#d1fadf" />
        <path
          d="M10.5 16.2l3.2 3.2 7.8-7.8"
          fill="none"
          stroke="#039855"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#12b76a" />
      <path
        d="M10.5 16.2l3.2 3.2 7.8-7.8"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCam() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-2h6l2 2h3v11H4V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7h.01" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="4" />
      <path d="M12 15h9l-2 2 2 2" />
    </svg>
  );
}

function IconDevice() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

const GPS_TRACKER_IMG = `${process.env.PUBLIC_URL || ''}/images/shop/gps-tracker-v4.png`;

function formatPetAge(dateOfBirth, t) {
  if (!dateOfBirth) return '';
  const born = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(born.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) years -= 1;
  if (years < 1) {
    let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
    if (now.getDate() < born.getDate()) months -= 1;
    if (months < 1) return t('myPets.ageUnderOneMonth');
    return t('myPets.ageMonths', { count: months });
  }
  return t('myPets.ageYears', { count: years });
}

export default function MyPets() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { show } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { pets, ownedPets, sharedPets, addPet, updatePet, removePet, getCategory } = usePets();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [colorScheme, setColorScheme] = useState('');
  const [identifyingMarks, setIdentifyingMarks] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [veterinarian, setVeterinarian] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [accountType, setAccountType] = useState('individual');
  const [friendlyWith, setFriendlyWith] = useState({ dogs: false, cats: false, people: false, children: false });
  const [addMoreOpen, setAddMoreOpen] = useState(true);
  const [addPhotoPreview, setAddPhotoPreview] = useState('');
  const [addPhotoFocus, setAddPhotoFocus] = useState({ x: 0.5, y: 0.5 });
  const addPhotoDragRef = useRef(null);
  const [categoryId, setCategoryId] = useState('dog');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('dog');
  const [editDevice, setEditDevice] = useState('');
  const [editGpsEnabled, setEditGpsEnabled] = useState(false);
  const [editNfcEnabled, setEditNfcEnabled] = useState(false);
  const [editBreed, setEditBreed] = useState('');
  const [editGender, setEditGender] = useState('male');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editMicrochipNo, setEditMicrochipNo] = useState('');
  const [registeredImeis, setRegisteredImeis] = useState([]);

  useEffect(() => {
    let cancelled = false;
    void fetchRegisteredTrackerImeis().then((rows) => {
      if (!cancelled) setRegisteredImeis(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [editColorScheme, setEditColorScheme] = useState('');
  const [editIdentifyingMarks, setEditIdentifyingMarks] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVeterinarian, setEditVeterinarian] = useState('');
  const [editFriendlyWith, setEditFriendlyWith] = useState({ dogs: false, cats: false, people: false, children: false });
  const [addPhotoBusy, setAddPhotoBusy] = useState(false);
  const [editPhotoBusy, setEditPhotoBusy] = useState(false);
  const [addPetDrawerOpen, setAddPetDrawerOpen] = useState(false);
  const [editPanel, setEditPanel] = useState('hub');
  const [menuPetId, setMenuPetId] = useState(null);
  const [addedSuccess, setAddedSuccess] = useState(null);
  const [fullscreenPhotoUrl, setFullscreenPhotoUrl] = useState('');
  const [medModalPet, setMedModalPet] = useState(null);
  const [sharePet, setSharePet] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [search, setSearch] = useState('');
  const importRef = useRef(null);
  const addPhotoInputId = useId();
  const editPhotoInputId = useId();
  const addPhotoRef = useRef(null);
  const editPhotoRef = useRef(null);
  const editingPet = useMemo(() => pets.find((p) => p.id === editingId) || null, [pets, editingId]);
  const genderOptions = useMemo(
    () => [
      ['male', t('petPublic.male')],
      ['female', t('petPublic.female')],
    ],
    [t]
  );
  const friendlyWithOptions = useMemo(
    () => [
      ['dogs', t('petPublic.dogs')],
      ['cats', t('petPublic.cats')],
      ['people', t('petPublic.people')],
      ['children', t('petPublic.children')],
    ],
    [t]
  );

  const filteredPets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ownedPets;
    return ownedPets.filter((p) => {
      const c = getCategory(p);
      return [p.name, p.breed, p.trackingDeviceId, c.id]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    });
  }, [ownedPets, search, getCategory]);

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
    const params = new URLSearchParams(location.search);
    const petId = params.get('pet');
    if (!petId || !pets.length) return;
    const p = pets.find((row) => row.id === petId);
    if (!p) return;
    setEditingId(p.id);
    setEditPanel('hub');
    setEditName(p.name);
    setEditCategoryId(p.categoryId);
    setEditDevice(p.trackingDeviceId || '');
    setEditGpsEnabled(Boolean(p.linkedTracker ?? p.trackingDeviceId));
    setEditNfcEnabled(Boolean(p.nfcTag));
    setEditBreed(p.breed || '');
    setEditGender(p.gender === 'female' ? 'female' : 'male');
    setEditDateOfBirth(p.dateOfBirth || '');
    setEditMicrochipNo(p.microchipNo || '');
    setEditColorScheme(p.colorScheme || '');
    setEditIdentifyingMarks(p.identifyingMarks || '');
    setEditDescription(p.description || '');
    setEditVeterinarian(p.veterinarian || '');
    const setFrom = Array.isArray(p.friendlyWith) ? p.friendlyWith : [];
    setEditFriendlyWith({
      dogs: setFrom.includes('dogs'),
      cats: setFrom.includes('cats'),
      people: setFrom.includes('people'),
      children: setFrom.includes('children'),
    });
    if (editPhotoRef.current) editPhotoRef.current.value = '';
  }, [location.search, pets]);

  useEffect(() => {
    if (!addPetDrawerOpen && !editingId) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setAddPetDrawerOpen(false);
        setEditingId(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [addPetDrawerOpen, editingId]);

  useBodyScrollLock(
    Boolean(addPetDrawerOpen || editingId || addedSuccess || sharePet || medModalPet || fullscreenPhotoUrl)
  );

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
      gender,
      trackingDeviceId: null,
      breed,
      dateOfBirth,
      colorScheme,
      identifyingMarks,
      medicalNotes,
      description: medicalNotes,
      veterinarian: veterinarian.trim(),
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: ownerEmail.trim(),
      nfcTag: false,
      friendlyWith: Object.entries(friendlyWith)
        .filter(([, v]) => !!v)
        .map(([k]) => k),
    });

    let photoUrl = '';
    const f = addPhotoRef.current?.files;
    if (createdPetId && f && f[0] && user?.uid) {
      setAddPhotoBusy(true);
      try {
        const photoUpload = await uploadPetPhoto({
          uid: user.uid,
          file: f[0],
          petId: createdPetId,
          focusX: addPhotoFocus.x,
          focusY: addPhotoFocus.y,
        });
        if (photoUpload) {
          photoUrl = photoUpload.photoUrl || '';
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
    const addedName = name.trim();
    const addedCategoryId = categoryId;
    setName('');
    setBreed('');
    setGender('male');
    setDateOfBirth('');
    setColorScheme('');
    setIdentifyingMarks('');
    setMedicalNotes('');
    setVeterinarian('');
    setOwnerName('');
    setOwnerPhone('');
    setOwnerEmail('');
    setFriendlyWith({ dogs: false, cats: false, people: false, children: false });
    setAddMoreOpen(true);
    setCategoryId('dog');
    setAddPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setAddPhotoFocus({ x: 0.5, y: 0.5 });
    if (addPhotoRef.current) addPhotoRef.current.value = '';
    setAddPetDrawerOpen(false);
    if (createdPetId) {
      setAddedSuccess({
        id: createdPetId,
        name: addedName,
        categoryId: addedCategoryId,
        photoUrl,
      });
    }
  }

  function startEdit(p, panel = 'hub') {
    setEditingId(p.id);
    setEditPanel(panel);
    setMenuPetId(null);
    setEditName(p.name);
    setEditCategoryId(p.categoryId);
    setEditDevice(p.trackingDeviceId || '');
    setEditGpsEnabled(Boolean(p.linkedTracker ?? p.trackingDeviceId));
    setEditNfcEnabled(Boolean(p.nfcTag));
    setEditBreed(p.breed || '');
    setEditGender(p.gender === 'female' ? 'female' : 'male');
    setEditDateOfBirth(p.dateOfBirth || '');
    setEditMicrochipNo(p.microchipNo || '');
    setEditColorScheme(p.colorScheme || '');
    setEditIdentifyingMarks(p.identifyingMarks || '');
    setEditDescription(p.description || '');
    setEditVeterinarian(p.veterinarian || '');
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
    const nextImei = editGpsEnabled ? editDevice.trim() : '';
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
      gender: editGender,
      linkedTracker: editGpsEnabled,
      nfcTag: editNfcEnabled,
      trackingDeviceId: editGpsEnabled ? editDevice.trim() || null : null,
      breed: editBreed,
      dateOfBirth: editDateOfBirth,
      microchipNo: editMicrochipNo,
      colorScheme: editColorScheme,
      identifyingMarks: editIdentifyingMarks,
      description: editDescription,
      veterinarian: editVeterinarian.trim(),
      friendlyWith: Object.entries(editFriendlyWith)
        .filter(([, v]) => !!v)
        .map(([k]) => k),
      ...(photoPatch
        ? { photoUrl: photoPatch.photoUrl, photoStoragePath: photoPatch.photoStoragePath, photoDataUrl: null }
        : {}),
    });
    const linkedImei = editGpsEnabled ? editDevice.trim() : '';
    if (linkedImei && linkedImei !== prevImei) {
      void linkPetTrackerImei(linkedImei)
        .then(() => show(t('myPets.trackerLinked'), { kind: 'success' }))
        .catch(() => show(t('myPets.trackerLinkFailed'), { kind: 'error' }));
    }
    setEditingId(null);
    if (editPhotoRef.current) editPhotoRef.current.value = '';
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-myPetsHeader">
          <h1 className="pp-h1 pp-myPetsHeader__title">{t('myPets.title')}</h1>
          <p className="pp-myPetsHeader__sub">{t('myPets.packSub')}</p>
        </div>
        <div className="pp-myPetsToolbar">
          <div className="pp-petSearchBox pp-myPetsToolbar__search">
            <IconSearch />
            <input
              className="pp-input pp-myPetsToolbar__searchInput"
              placeholder={t('myPets.searchPets')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="pp-myPetsToolbar__actions">
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
        </div>
        <button
          id="add-pet-open"
          type="button"
          className="pp-btn pp-btnPrimary pp-myPetsAddWide"
          onClick={() => setAddPetDrawerOpen(true)}
        >
          + {t('myPets.addTitle')}
        </button>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-myPetsPackCard">
          {ownedPets.length === 0 ? (
            <p className="pp-subtle">{t('myPets.noPets')}</p>
          ) : (
            <ul className="pp-petList">
              {filteredPets.map((p) => {
                const age = formatPetAge(p.dateOfBirth, t);
                const meta = [p.breed, age].filter(Boolean).join(' · ');
                const gpsOn = Boolean(p.linkedTracker || p.trackingDeviceId);
                const profileOn = Boolean(p.nfcTag || p.publicProfileId || p.id);
                return (
                  <li key={p.id} className="pp-petList__item pp-petCardFriendly">
                    <div className="pp-petCardFriendly__top">
                      <button
                        type="button"
                        className="pp-petCardFriendly__photo"
                        onClick={() => setFullscreenPhotoUrl(p.photoUrl || p.photoDataUrl || '')}
                        aria-label={p.photoUrl || p.photoDataUrl ? t('myPets.openPhotoFullscreen') : t('myPets.noPhoto')}
                        disabled={!p.photoUrl && !p.photoDataUrl}
                      >
                        <PetAvatar pet={p} size={64} />
                      </button>
                      <div className="pp-petCardFriendly__main">
                        <div className="pp-petList__name">
                          {p.name}{' '}
                          <span className={`pp-petGender ${p.gender === 'female' ? 'is-f' : 'is-m'}`} aria-hidden>
                            {p.gender === 'female' ? '♀' : '♂'}
                          </span>
                        </div>
                        {meta ? <div className="pp-petList__meta">{meta}</div> : null}
                        <div className="pp-petList__tags">
                          <span className={`pp-petTag pp-petTag--soft ${gpsOn ? 'is-on' : 'is-off'}`}>
                            <IconPin /> {gpsOn ? t('myPets.gpsLinked') : t('myPets.noTracker')}
                          </span>
                          <span className={`pp-petTag pp-petTag--soft ${profileOn ? 'is-profile' : 'is-off'}`}>
                            <IconSignal /> {t('myPets.profileActive')}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="pp-petCardFriendly__chev"
                        onClick={() => startEdit(p)}
                        aria-label={t('myPets.manage')}
                      >
                        ›
                      </button>
                    </div>
                    <button
                      type="button"
                      className="pp-btn pp-petCardFriendly__publicBtn"
                      onClick={() => {
                        const publicId = p.publicProfileId || p.id;
                        window.location.href = `/pet/${encodeURIComponent(publicId)}`;
                      }}
                    >
                      <IconEye /> {t('myPets.viewPublicProfile')}
                    </button>
                    <div className="pp-petCardFriendly__actions">
                      <button type="button" className="pp-btn pp-btnOutline pp-petCardFriendly__manage" onClick={() => startEdit(p)}>
                        {t('myPets.manage')}
                      </button>
                      <div className="pp-petCardFriendly__moreWrap">
                        <button
                          type="button"
                          className="pp-btn pp-petCardFriendly__more"
                          aria-label={t('myPets.moreActions')}
                          aria-expanded={menuPetId === p.id}
                          onClick={() => setMenuPetId((id) => (id === p.id ? null : p.id))}
                        >
                          <IconMore />
                        </button>
                        {menuPetId === p.id ? (
                          <div className="pp-petCardFriendly__menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              className="is-danger"
                              onClick={async () => {
                                setMenuPetId(null);
                                if (!window.confirm(t('myPets.removeConfirm', { name: p.name }))) return;
                                await deletePetPhoto({ photoStoragePath: p.photoStoragePath, photoUrl: p.photoUrl });
                                removePet(p.id);
                              }}
                            >
                              <IconTrash /> {t('myPets.remove')}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="pp-petCardFriendly__quick">
                      <button
                        type="button"
                        className="pp-btn pp-petCardFriendly__quickBtn"
                        onClick={() => setMedModalPet(p)}
                      >
                        <IconMedPill size={16} />
                        <span>{t('myPets.medsOpen')}</span>
                      </button>
                      <button
                        type="button"
                        className="pp-btn pp-petCardFriendly__quickBtn"
                        onClick={() => {
                          setSharePet(p);
                          setShareEmail('');
                        }}
                      >
                        <IconShare />
                        <span>{t('myPets.sharePet')}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {sharedPets.length ? (
            <>
              <h2 className="pp-sectionTitle" style={{ marginTop: 24 }}>
                {t('myPets.sharedWithYou', { count: sharedPets.length })}
              </h2>
              <ul className="pp-petList">
                {sharedPets.map((p) => (
                  <li key={`shared-${p.id}`} className="pp-petList__item">
                    <div className="pp-petList__row">
                      <PetAvatar pet={p} size={56} />
                      <div className="pp-petList__main">
                        <div className="pp-petList__titleRow">
                          <strong>{p.name}</strong>
                          <span className="pp-petTag">{t('myPets.sharedBadge')}</span>
                        </div>
                        {p.trackingDeviceId ? (
                          <div className="pp-petList__meta">{t('myPets.listDevice')} {p.trackingDeviceId}</div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
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
                <p className="pp-subtle" style={{ margin: '6px 0 0' }}>{t('myPets.addPetSub')}</p>
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
              <div className="pp-speciesCarousel" role="group" aria-label={t('myPets.category')}>
                {PET_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pp-speciesChip ${categoryId === c.id ? 'is-on' : ''}`}
                    onClick={() => setCategoryId(c.id)}
                  >
                    <span className="pp-speciesChip__ico" aria-hidden>{c.emoji}</span>
                    <span className="pp-speciesChip__label">{t(`categories.${c.id}`)}</span>
                  </button>
                ))}
              </div>

              {addPhotoPreview ? (
                <div className="pp-photoAlign">
                  <div
                    className="pp-photoAlign__circle"
                    role="presentation"
                    aria-label={t('myPets.photoAlignHint')}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const el = e.currentTarget;
                      el.setPointerCapture?.(e.pointerId);
                      addPhotoDragRef.current = {
                        active: true,
                        x: e.clientX,
                        y: e.clientY,
                        w: el.clientWidth || 1,
                        h: el.clientHeight || 1,
                      };
                      el.classList.add('is-dragging');
                    }}
                    onPointerMove={(e) => {
                      const drag = addPhotoDragRef.current;
                      if (!drag?.active) return;
                      const dx = e.clientX - drag.x;
                      const dy = e.clientY - drag.y;
                      drag.x = e.clientX;
                      drag.y = e.clientY;
                      setAddPhotoFocus((p) => ({
                        x: Math.min(1, Math.max(0, p.x - dx / drag.w)),
                        y: Math.min(1, Math.max(0, p.y - dy / drag.h)),
                      }));
                    }}
                    onPointerUp={(e) => {
                      addPhotoDragRef.current = null;
                      e.currentTarget.classList.remove('is-dragging');
                    }}
                    onPointerCancel={(e) => {
                      addPhotoDragRef.current = null;
                      e.currentTarget.classList.remove('is-dragging');
                    }}
                  >
                    <img
                      src={addPhotoPreview}
                      alt=""
                      draggable={false}
                      style={{ objectPosition: `${addPhotoFocus.x * 100}% ${addPhotoFocus.y * 100}%` }}
                    />
                  </div>
                  <div className="pp-photoAlign__controls">
                    <p className="pp-photoAlign__hint">{t('myPets.photoAlignHint')}</p>
                    <label className="pp-btn pp-btnGhostSm" htmlFor={addPhotoInputId}>
                      <IconCam /> {t('myPets.changePhoto')}
                    </label>
                  </div>
                  <input
                    id={addPhotoInputId}
                    ref={addPhotoRef}
                    type="file"
                    accept="image/*"
                    className="pp-photoDrop__input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setAddPhotoPreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return file ? URL.createObjectURL(file) : '';
                      });
                      setAddPhotoFocus({ x: 0.5, y: 0.5 });
                    }}
                  />
                </div>
              ) : (
                <label className="pp-photoDrop pp-photoDrop--compact" htmlFor={addPhotoInputId}>
                  <span className="pp-photoDrop__ico" aria-hidden><IconCam /></span>
                  <strong>{t('myPets.photoDropTitle')}</strong>
                  <span>{t('myPets.photoDropHint')}</span>
                  <input
                    id={addPhotoInputId}
                    ref={addPhotoRef}
                    type="file"
                    accept="image/*"
                    className="pp-photoDrop__input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setAddPhotoPreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return file ? URL.createObjectURL(file) : '';
                      });
                      setAddPhotoFocus({ x: 0.5, y: 0.5 });
                    }}
                  />
                </label>
              )}

              <div>
                <div className="pp-label">{t('myPets.name')} *</div>
                <input
                  className="pp-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('myPets.namePh')}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="pp-label">{t('petPublic.breed')} *</div>
                <input
                  className="pp-input"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  placeholder={t('myPets.breedPh')}
                  required
                />
              </div>

              <div>
                <div className="pp-label">{t('petPublic.gender')}</div>
                <div className="pp-genderSeg" role="group" aria-label={t('petPublic.gender')}>
                  <button
                    type="button"
                    className={`pp-genderSeg__btn ${gender === 'male' ? 'is-on' : ''}`}
                    onClick={() => setGender('male')}
                  >
                    <span className="pp-genderSeg__ico is-m" aria-hidden>♂</span>
                    <span>{t('petPublic.male')}</span>
                  </button>
                  <button
                    type="button"
                    className={`pp-genderSeg__btn ${gender === 'female' ? 'is-on' : ''}`}
                    onClick={() => setGender('female')}
                  >
                    <span className="pp-genderSeg__ico is-f" aria-hidden>♀</span>
                    <span>{t('petPublic.female')}</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="pp-label">{t('petPublic.dob')} *</div>
                <input
                  className="pp-input pp-dateField__inputNative"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                />
              </div>

              <div>
                <div className="pp-label">{t('petPublic.color')} *</div>
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

              <button
                type="button"
                className={`pp-addMoreToggle ${addMoreOpen ? 'is-open' : ''}`}
                aria-expanded={addMoreOpen}
                onClick={() => setAddMoreOpen((v) => !v)}
              >
                <span>{t('myPets.addOptionalToggle')}</span>
                <span aria-hidden>{addMoreOpen ? '▴' : '▾'}</span>
              </button>

              {addMoreOpen ? (
                <div className="pp-addMorePanel">
                  <div>
                    <div className="pp-label">{t('petPublic.traits')}</div>
                    <input className="pp-input" value={identifyingMarks} onChange={(e) => setIdentifyingMarks(e.target.value)} />
                  </div>

                  <div>
                    <div className="pp-label">{t('petPublic.friendly')}</div>
                    <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      {friendlyWithOptions.map(([key, label]) => (
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
                    <div className="pp-label">{t('myPets.aboutNotes')}</div>
                    <textarea
                      className="pp-input"
                      value={medicalNotes}
                      onChange={(e) => setMedicalNotes(e.target.value)}
                      maxLength={2000}
                      placeholder={t('myPets.aboutNotesPh')}
                      style={{ minHeight: 80, resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <div className="pp-label">{t('petPublic.veterinarian')}</div>
                    <input
                      className="pp-input"
                      value={veterinarian}
                      onChange={(e) => setVeterinarian(e.target.value)}
                      placeholder={t('myPets.vetPh')}
                      autoComplete="off"
                    />
                  </div>

                  <div className="pp-modalGrid2">
                    <div>
                      <div className="pp-label">{t('myPets.ownerName')}</div>
                      <input className="pp-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                    </div>
                    <div>
                      <div className="pp-label">{t('myPets.ownerPhone')}</div>
                      <input className="pp-input" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
                    </div>
                    <div>
                      <div className="pp-label">{t('myPets.ownerEmail')}</div>
                      <input className="pp-input" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
                    </div>
                  </div>
                </div>
              ) : null}

              <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                {t('myPets.addGpsLaterHint')}
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
                  {addPhotoBusy ? t('myPets.processing') : t('myPets.addToPack')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingPet ? (
        <div className="pp-modalWrap" role="dialog" aria-modal="true" aria-labelledby="edit-pet-title">
          <button
            type="button"
            className="pp-modalBackdrop"
            aria-label={t('common.cancel')}
            onClick={() => setEditingId(null)}
          />
          <div className="pp-modalCard pp-modalCard--petEdit">
            <div className="pp-modalHead">
              <div className="pp-modalHead__lead">
                {editPanel !== 'hub' ? (
                  <button type="button" className="pp-iconRoundBtn" onClick={() => setEditPanel('hub')} aria-label={t('common.back')}>
                    <IconBack />
                  </button>
                ) : null}
                <div>
                  <h2 id="edit-pet-title" className="pp-sectionTitle" style={{ margin: 0 }}>
                    {editPanel === 'hub' && t('myPets.editTitle', { name: editingPet.name || '' })}
                    {editPanel === 'details' && t('myPets.panelDetails')}
                    {editPanel === 'gps' && t('myPets.panelGps')}
                    {editPanel === 'nfc' && t('myPets.panelPublic')}
                    {editPanel === 'more' && t('myPets.panelMore', { name: editingPet.name || '' })}
                  </h2>
                  {editPanel === 'hub' ? (
                    <p className="pp-subtle" style={{ margin: '6px 0 0' }}>{t('myPets.editPetSub')}</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="pp-iconRoundBtn"
                onClick={() => setEditingId(null)}
                aria-label={t('common.cancel')}
                title={t('common.cancel')}
              >
                ✕
              </button>
            </div>

            <form className="pp-form pp-modalForm" onSubmit={saveEdit}>
              {editPanel === 'hub' ? (
                <>
                  <div className="pp-editHubStrip">
                    <PetAvatar pet={editingPet} size={72} />
                    <div>
                      <div className="pp-petList__name">
                        {editingPet.name}{' '}
                        <span className={`pp-petGender ${editGender === 'female' ? 'is-f' : 'is-m'}`} aria-hidden>
                          {editGender === 'female' ? '♀' : '♂'}
                        </span>
                      </div>
                      <div className="pp-petList__meta">
                        {[editBreed, formatPetAge(editDateOfBirth, t)].filter(Boolean).join(' · ')}
                      </div>
                      <label className="pp-btn pp-btnGhostSm" htmlFor={editPhotoInputId}>
                        <IconCam /> {t('myPets.changePhoto')}
                        <input id={editPhotoInputId} ref={editPhotoRef} type="file" accept="image/*" className="pp-photoDrop__input" />
                      </label>
                    </div>
                  </div>

                  <div className="pp-editNavList">
                    <button type="button" className="pp-editNavItem" onClick={() => setEditPanel('details')}>
                      <span className="pp-editNavIco is-purple"><IconDoc /></span>
                      <span>
                        <strong>{t('myPets.panelDetails')}</strong>
                        <small>{t('myPets.panelDetailsSub')}</small>
                      </span>
                      <span className="pp-editNavChev">›</span>
                    </button>
                    <button type="button" className="pp-editNavItem" onClick={() => setEditPanel('gps')}>
                      <span className="pp-editNavIco is-green"><IconPin /></span>
                      <span>
                        <strong>
                          {t('myPets.panelGps')}{' '}
                          {editGpsEnabled && editDevice.trim() ? <span className="pp-petTag pp-petTag--soft is-on">{t('myPets.linkedBadge')}</span> : null}
                        </strong>
                        <small>{t('myPets.panelGpsSub')}</small>
                      </span>
                      <span className="pp-editNavChev">›</span>
                    </button>
                    <button type="button" className="pp-editNavItem" onClick={() => setEditPanel('nfc')}>
                      <span className="pp-editNavIco is-blue"><IconPaw /></span>
                      <span>
                        <strong>
                          {t('myPets.panelPublic')}{' '}
                          <span className="pp-petTag pp-petTag--soft is-profile">{t('myPets.activeBadge')}</span>
                        </strong>
                        <small>{t('myPets.panelPublicSub')}</small>
                      </span>
                      <span className="pp-editNavChev">›</span>
                    </button>
                    <button type="button" className="pp-editNavItem" onClick={() => setEditPanel('more')}>
                      <span className="pp-editNavIco is-orange"><IconMoreAbout /></span>
                      <span>
                        <strong>{t('myPets.panelMore', { name: editingPet.name || '' })}</strong>
                        <small>{t('myPets.panelMoreSub')}</small>
                      </span>
                      <span className="pp-editNavChev">›</span>
                    </button>
                    <button
                      type="button"
                      className="pp-editNavItem"
                      onClick={() => {
                        setMedModalPet(editingPet);
                      }}
                    >
                      <span className="pp-editNavIco is-green"><IconMedPill size={18} /></span>
                      <span>
                        <strong>{t('myPets.medsOpen')}</strong>
                        <small>{t('myPets.panelMedsSub')}</small>
                      </span>
                      <span className="pp-editNavChev">›</span>
                    </button>
                    <button
                      type="button"
                      className="pp-editNavItem"
                      onClick={() => {
                        setSharePet(editingPet);
                        setShareEmail('');
                      }}
                    >
                      <span className="pp-editNavIco is-purple"><IconShare /></span>
                      <span>
                        <strong>{t('myPets.sharePet')}</strong>
                        <small>{t('myPets.panelShareSub')}</small>
                      </span>
                      <span className="pp-editNavChev">›</span>
                    </button>
                    <button
                      type="button"
                      className="pp-editNavItem"
                      onClick={() => {
                        setEditingId(null);
                        navigate('/profile');
                      }}
                    >
                      <span className="pp-editNavIco is-blue"><IconDoc /></span>
                      <span>
                        <strong>{t('myPets.panelOwner')}</strong>
                        <small>{t('myPets.panelOwnerSub')}</small>
                      </span>
                      <span className="pp-editNavChev">›</span>
                    </button>
                  </div>
                </>
              ) : null}

              {editPanel === 'details' ? (
                <>
                  <div>
                    <div className="pp-label">{t('myPets.category')} *</div>
                    <PrettySelect value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                      {PET_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {t(`categories.${c.id}`)}
                        </option>
                      ))}
                    </PrettySelect>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div className="pp-label">{t('myPets.name')} *</div>
                    <input
                      className="pp-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t('myPets.namePh')}
                      autoComplete="off"
                      autoFocus
                      required
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div className="pp-label">{t('petPublic.breed')} *</div>
                    <input className="pp-input" value={editBreed} onChange={(e) => setEditBreed(e.target.value)} required />
                  </div>
                  <div>
                    <div className="pp-label">{t('petPublic.gender')}</div>
                    <div className="pp-genderSeg" role="group" aria-label={t('petPublic.gender')}>
                      <button
                        type="button"
                        className={`pp-genderSeg__btn ${editGender === 'male' ? 'is-on' : ''}`}
                        onClick={() => setEditGender('male')}
                      >
                        <span className="pp-genderSeg__ico is-m" aria-hidden>♂</span>
                        <span>{t('petPublic.male')}</span>
                      </button>
                      <button
                        type="button"
                        className={`pp-genderSeg__btn ${editGender === 'female' ? 'is-on' : ''}`}
                        onClick={() => setEditGender('female')}
                      >
                        <span className="pp-genderSeg__ico is-f" aria-hidden>♀</span>
                        <span>{t('petPublic.female')}</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="pp-label">{t('petPublic.dob')} *</div>
                    <input
                      className="pp-input pp-dateField__inputNative"
                      type="date"
                      value={editDateOfBirth}
                      onChange={(e) => setEditDateOfBirth(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <div className="pp-label">{t('petPublic.color')} *</div>
                    <input
                      className="pp-input"
                      value={editColorScheme}
                      onChange={(e) => setEditColorScheme(e.target.value)}
                      maxLength={120}
                      placeholder={t('myPets.colorPh')}
                      autoComplete="off"
                      required
                    />
                  </div>
                </>
              ) : null}

              {editPanel === 'gps' ? (
                <>
                  <label className="pp-shopTrackerOpt pp-gpsLiveToggle">
                    <span className="pp-editNavIco is-green"><IconPin /></span>
                    <span className="pp-shopTrackerOpt__copy">
                      <strong>{t('myPets.gpsEnabledTitle')}</strong>
                      <small>{t('myPets.gpsEnabledSubNamed', { name: editingPet.name || '' })}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={editGpsEnabled}
                      onChange={(e) => setEditGpsEnabled(e.target.checked)}
                    />
                    <span className="pp-shopTrackerOpt__meta">
                      <span className="pp-shopTrackerOpt__switch" aria-hidden />
                    </span>
                  </label>

                  {editGpsEnabled && editDevice.trim() ? (
                    <div className="pp-gpsLinkedCard">
                      <div className="pp-gpsLinkedCard__row">
                        <img className="pp-gpsLinkedCard__img" src={GPS_TRACKER_IMG} alt="" />
                        <div>
                          <span className="pp-petTag pp-petTag--soft is-on"><IconKey /> {t('myPets.trackerLinkedBadge')}</span>
                          <p className="pp-petList__meta" style={{ marginTop: 8 }}>IMEI: {editDevice.trim()}</p>
                          <p className="pp-petList__meta">{t('myPets.lastSeenUnknown')}</p>
                        </div>
                      </div>
                      <div className="pp-gpsLinkedCard__actions">
                        <button
                          type="button"
                          className="pp-btn pp-btnOutline"
                          onClick={() => {
                            setEditDevice('');
                          }}
                        >
                          {t('myPets.changeTracker')}
                        </button>
                        <button
                          type="button"
                          className="pp-btn pp-btnDangerOutline"
                          onClick={() => {
                            setEditGpsEnabled(false);
                            setEditDevice('');
                          }}
                        >
                          {t('myPets.unlinkTracker')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pp-gpsEmptyCard">
                      <span className="pp-gpsEmptyCard__ico" aria-hidden><IconDevice /></span>
                      <strong>{t('myPets.noTracker')}</strong>
                      <p className="pp-subtle">{t('myPets.linkTrackerHint', { name: editingPet.name || '' })}</p>
                    </div>
                  )}

                  <div className="pp-label" style={{ marginTop: 14 }}>
                    {editGpsEnabled && editDevice.trim() ? t('myPets.linkDifferentTracker') : t('myPets.linkNewTracker')}
                  </div>
                  {!(editGpsEnabled && editDevice.trim()) ? (
                    <p className="pp-subtle" style={{ marginTop: 0 }}>{t('myPets.linkTrackerHelp')}</p>
                  ) : null}
                  <div className="pp-row" style={{ alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      className="pp-input"
                      style={{ flex: '1 1 160px', minWidth: 0 }}
                      value={editDevice}
                      onChange={(e) => {
                        setEditDevice(e.target.value);
                        if (e.target.value.trim()) setEditGpsEnabled(true);
                      }}
                      placeholder={t('myPets.deviceIdPh')}
                      autoComplete="off"
                      inputMode="numeric"
                      list="registered-tracker-imeis"
                    />
                    <ImeiQrScannerButton
                      onImei={(imei) => {
                        onScanImeiEdit(imei);
                        setEditGpsEnabled(true);
                      }}
                      disabled={editPhotoBusy}
                    />
                  </div>
                  {!(editGpsEnabled && editDevice.trim()) ? (
                    <button
                      type="button"
                      className="pp-btn pp-btnPrimary"
                      style={{ width: '100%', marginTop: 12 }}
                      onClick={() => {
                        if (editDevice.trim()) setEditGpsEnabled(true);
                      }}
                    >
                      {t('myPets.linkTrackerCta')}
                    </button>
                  ) : null}
                  <a className="pp-helpBar" href="/docs" onClick={(e) => e.preventDefault()}>
                    <span className="pp-editNavIco is-blue"><IconInfo /></span>
                    {t('myPets.whereImei')}
                    <span className="pp-editNavChev">›</span>
                  </a>
                </>
              ) : null}

              {editPanel === 'nfc' ? (
                <>
                  <label className={`pp-shopTrackerOpt pp-gpsLiveToggle ${editNfcEnabled ? 'is-on' : ''}`}>
                    <span className="pp-nfcTickWrap" aria-hidden>
                      <IconGreenTick soft size={36} />
                    </span>
                    <span className="pp-shopTrackerOpt__copy">
                      <strong>{t('myPets.nfcEnabledTitle')}</strong>
                      <small>{t('myPets.nfcEnabledSubNamed', { name: editingPet.name || '' })}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={editNfcEnabled}
                      onChange={(e) => setEditNfcEnabled(e.target.checked)}
                    />
                    <span className="pp-shopTrackerOpt__meta">
                      <span className={`pp-shopTrackerOpt__switch ${editNfcEnabled ? 'is-on' : ''}`} aria-hidden />
                    </span>
                  </label>
                  {editNfcEnabled ? (
                    <div className="pp-nfcActiveBanner">
                      <span className="pp-nfcActiveBanner__tick" aria-hidden>
                        <IconGreenTick size={28} />
                      </span>
                      <div>
                        <strong>{t('myPets.nfcActiveTitle')}</strong>
                        <small>{t('myPets.nfcActiveSub', { name: editingPet.name || '' })}</small>
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="pp-btn pp-btnPrimary"
                    style={{ width: '100%', marginTop: 14 }}
                    onClick={() => {
                      const publicId = editingPet.publicProfileId || editingPet.id;
                      window.location.href = `/pet/${encodeURIComponent(publicId)}`;
                    }}
                  >
                    {t('myPets.viewPublicProfile')}
                  </button>
                  <div className="pp-nfcHow">
                    <span className="pp-editNavIco is-purple"><IconPaw /></span>
                    <div>
                      <strong>{t('myPets.nfcHowTitle')}</strong>
                      <small>{t('myPets.nfcHowBody')}</small>
                    </div>
                  </div>
                </>
              ) : null}

              {editPanel === 'more' ? (
                <>
                  <div>
                    <div className="pp-label">{t('petPublic.traits')}</div>
                    <input className="pp-input" value={editIdentifyingMarks} onChange={(e) => setEditIdentifyingMarks(e.target.value)} />
                  </div>
                  <div>
                    <div className="pp-label">{t('myPets.descriptionLabel')}</div>
                    <textarea
                      className="pp-input"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      maxLength={2000}
                      style={{ minHeight: 80, resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <div className="pp-label">{t('petPublic.veterinarian')}</div>
                    <input
                      className="pp-input"
                      value={editVeterinarian}
                      onChange={(e) => setEditVeterinarian(e.target.value)}
                      placeholder={t('myPets.vetPh')}
                    />
                  </div>
                  <div>
                    <div className="pp-label">{t('petPublic.friendly')}</div>
                    <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      {friendlyWithOptions.map(([key, label]) => (
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
                </>
              ) : null}

              <div className="pp-modalActions">
                <button type="button" className="pp-btn" onClick={() => (editPanel === 'hub' ? setEditingId(null) : setEditPanel('hub'))}>
                  {editPanel === 'hub' ? t('common.cancel') : t('common.back')}
                </button>
                <button
                  type="submit"
                  className="pp-btn pp-btnPrimary"
                  disabled={!editName.trim() || !editBreed.trim() || !editDateOfBirth || !editColorScheme.trim() || editPhotoBusy}
                >
                  {editPhotoBusy ? t('myPets.processing') : t('myPets.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {addedSuccess ? (
        <div className="pp-modalWrap" role="dialog" aria-modal="true" aria-labelledby="add-success-title">
          <button type="button" className="pp-modalBackdrop" aria-label={t('common.close')} onClick={() => setAddedSuccess(null)} />
          <div className="pp-modalCard pp-modalCard--petAdd pp-addSuccess">
            <div className="pp-modalHead">
              <div />
              <button type="button" className="pp-iconRoundBtn" onClick={() => setAddedSuccess(null)} aria-label={t('common.close')}>
                ✕
              </button>
            </div>
            <div className="pp-addSuccess__body">
              <div className="pp-addSuccess__photoWrap">
                <PetAvatar pet={addedSuccess} size={120} />
                <span className="pp-addSuccess__check" aria-hidden>
                  <IconGreenTick size={34} />
                </span>
              </div>
              <h2 id="add-success-title">{t('myPets.addedTitle', { name: addedSuccess.name })}</h2>
              <p className="pp-subtle">{t('myPets.addedSub', { name: addedSuccess.name })}</p>
              <button
                type="button"
                className="pp-btn pp-btnPrimary"
                style={{ width: '100%' }}
                onClick={() => {
                  const publicId = addedSuccess.id;
                  setAddedSuccess(null);
                  window.location.href = `/pet/${encodeURIComponent(publicId)}`;
                }}
              >
                {t('myPets.viewPublicProfile')}
              </button>
              <button
                type="button"
                className="pp-btn pp-btnOutline"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => {
                  const pet = pets.find((row) => row.id === addedSuccess.id) || addedSuccess;
                  setAddedSuccess(null);
                  startEdit(pet, 'gps');
                }}
              >
                {t('myPets.setupGpsTracker')}
              </button>
              <button type="button" className="pp-linkBtn" onClick={() => { setAddedSuccess(null); setAddPetDrawerOpen(true); }}>
                {t('myPets.addAnotherPet')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sharePet ? (
        <div className="pp-modalWrap" role="dialog" aria-modal="true">
          <button type="button" className="pp-modalBackdrop" aria-label={t('myPets.cancel')} onClick={() => setSharePet(null)} />
          <div className="pp-modalCard pp-pad" style={{ maxWidth: 420 }}>
            <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>{t('myPets.shareTitle')}</h2>
            <p className="pp-subtle">{t('myPets.shareSub')}</p>
            <p className="pp-subtle"><strong>{sharePet.name}</strong></p>
            <input
              className="pp-input"
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              placeholder={t('myPets.shareEmailPh')}
              autoComplete="email"
            />
            <div className="pp-row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="pp-btn" onClick={() => setSharePet(null)}>{t('myPets.cancel')}</button>
              <button
                type="button"
                className="pp-btn pp-btn--primary"
                disabled={shareBusy || !shareEmail.trim()}
                onClick={async () => {
                  if (!user?.uid) return;
                  setShareBusy(true);
                  try {
                    await sharePetWithEmail({
                      ownerUid: user.uid,
                      petId: sharePet.id,
                      petName: sharePet.name,
                      email: shareEmail,
                    });
                    show(t('myPets.shareDone', { email: shareEmail.trim() }), { kind: 'success' });
                    setSharePet(null);
                  } catch (e) {
                    show(e?.message || t('myPets.shareErr'), { kind: 'error' });
                  } finally {
                    setShareBusy(false);
                  }
                }}
              >
                {shareBusy ? t('myPets.shareBusy') : t('myPets.shareSend')}
              </button>
            </div>
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
          aria-label={t('myPets.petPhotoFullScreen')}
          style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.94)', display: 'grid', placeItems: 'center', padding: 16 }}
        >
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              className="pp-btn"
              onClick={() => setFullscreenPhotoUrl('')}
              aria-label={t('myPets.closePhoto')}
              title={t('myPets.closePhoto')}
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
      <datalist id="registered-tracker-imeis">
        {registeredImeis.map((imei) => (
          <option key={imei} value={imei} />
        ))}
      </datalist>
    </div>
  );
}

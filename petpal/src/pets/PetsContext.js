import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
import { getPetCategory } from './petCategories';
import { createPet, deletePet, patchPet, subscribePets } from './petsFirestore';
import { fetchSharedPetsForUser } from './petShareFirestore';

/**
 * @typedef {{ id: string, name: string, categoryId: string, gender?: 'male'|'female', trackingDeviceId: string | null, createdAt: string, photoDataUrl?: string, photoUrl?: string, photoStoragePath?: string, colorScheme?: string, description?: string, age?: string, friendlyWith?: string[], breed?: string, microchipNo?: string, dateOfBirth?: string, identifyingMarks?: string, medicalNotes?: string, ownerName?: string, ownerPhone?: string, ownerEmail?: string }} Pet
 */

const MAX_COLOR_SCHEME = 120;
const MAX_PET_DESCRIPTION = 2000;
const MAX_AGE = 80;
const MAX_BREED = 120;
const MAX_MICROCHIP = 120;
const MAX_IDENTIFYING_MARKS = 300;
const MAX_MEDICAL_NOTES = 3000;
const MAX_OWNER_NAME = 120;
const MAX_OWNER_PHONE = 80;
const MAX_OWNER_EMAIL = 160;

const PetsContext = createContext(null);

function trimField(value, max) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function applyOptionalTextFields(next, patch) {
  const maxByKey = { colorScheme: MAX_COLOR_SCHEME, description: MAX_PET_DESCRIPTION, age: MAX_AGE };
  for (const key of ['colorScheme', 'description', 'age']) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const raw = patch[key];
    const s = trimField(raw == null ? '' : raw, maxByKey[key]);
    if (s) next[key] = s;
    else delete next[key];
  }
}

function normalizeFriendlyWith(value) {
  const allowed = new Set(['dogs', 'cats', 'people', 'children']);
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((x) => String(x || '').trim().toLowerCase())
    .filter((x) => allowed.has(x));
  return Array.from(new Set(cleaned));
}

export function PetsProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [pets, setPets] = useState(/** @type {Pet[]} */ ([]));
  const [sharedPets, setSharedPets] = useState(/** @type {Pet[]} */ ([]));

  useEffect(() => {
    if (!uid) {
      setPets([]);
      return;
    }
    const unsub = subscribePets(
      uid,
      (rows) => setPets(Array.isArray(rows) ? rows : []),
      () => setPets([])
    );
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setSharedPets([]);
      return;
    }
    let cancelled = false;
    void fetchSharedPetsForUser(uid, user?.email || '')
      .then(async (shares) => {
        const db = getDb();
        const loaded = [];
        for (const share of shares) {
          try {
            const snap = await getDoc(doc(db, 'users', share.ownerUid, 'pets', share.petId));
            if (snap.exists()) {
              loaded.push({
                id: snap.id,
                ...snap.data(),
                _sharedFrom: share.ownerUid,
                _isShared: true,
              });
            }
          } catch {
            // skip unreadable share
          }
        }
        if (!cancelled) setSharedPets(loaded);
      })
      .catch(() => {
        if (!cancelled) setSharedPets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, user?.email]);

  const addPet = useCallback(
    ({
      name,
      categoryId,
      gender = 'male',
      trackingDeviceId = null,
      photoDataUrl = undefined,
      photoUrl = undefined,
      photoStoragePath = undefined,
      colorScheme = '',
      description = '',
      age = '',
      friendlyWith = [],
      breed = '',
      microchipNo = '',
      dateOfBirth = '',
      identifyingMarks = '',
      medicalNotes = '',
      ownerName = '',
      ownerPhone = '',
      ownerEmail = '',
      nfcTag = false,
    }) => {
      const n = (name || '').trim();
      if (!n) return;
      const pet = {
        name: n,
        categoryId: categoryId || 'dog',
        gender: gender === 'female' ? 'female' : 'male',
        trackingDeviceId: trackingDeviceId && String(trackingDeviceId).trim() ? String(trackingDeviceId).trim() : null,
        linkedTracker: Boolean(trackingDeviceId && String(trackingDeviceId).trim()),
        nfcTag: Boolean(nfcTag),
        ...(typeof photoDataUrl === 'string' && photoDataUrl.startsWith('data:') ? { photoDataUrl } : {}),
        ...(typeof photoUrl === 'string' && photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}),
        ...(typeof photoStoragePath === 'string' && photoStoragePath.trim()
          ? { photoStoragePath: photoStoragePath.trim() }
          : {}),
      };
      const cs = trimField(colorScheme, MAX_COLOR_SCHEME);
      if (cs) pet.colorScheme = cs;
      const desc = trimField(description, MAX_PET_DESCRIPTION);
      if (desc) pet.description = desc;
      const ageStr = trimField(age, MAX_AGE);
      if (ageStr) pet.age = ageStr;
      const breedStr = trimField(breed, MAX_BREED);
      if (breedStr) pet.breed = breedStr;
      const microchipStr = trimField(microchipNo, MAX_MICROCHIP);
      if (microchipStr) pet.microchipNo = microchipStr;
      const dob = trimField(dateOfBirth, 32);
      if (dob) pet.dateOfBirth = dob;
      const marks = trimField(identifyingMarks, MAX_IDENTIFYING_MARKS);
      if (marks) pet.identifyingMarks = marks;
      const med = trimField(medicalNotes, MAX_MEDICAL_NOTES);
      if (med) pet.medicalNotes = med;
      const ownName = trimField(ownerName, MAX_OWNER_NAME);
      if (ownName) pet.ownerName = ownName;
      const ownPhone = trimField(ownerPhone, MAX_OWNER_PHONE);
      if (ownPhone) pet.ownerPhone = ownPhone;
      const ownEmail = trimField(ownerEmail, MAX_OWNER_EMAIL);
      if (ownEmail) pet.ownerEmail = ownEmail;
      const fw = normalizeFriendlyWith(friendlyWith);
      if (fw.length) pet.friendlyWith = fw;
      return createPet(uid, pet);
    },
    [uid]
  );

  const updatePet = useCallback(
    (id, patch) => {
      const normalized = {
        ...patch,
        ...(patch.name != null ? { name: String(patch.name).trim() } : {}),
        ...(patch.trackingDeviceId !== undefined
          ? {
              trackingDeviceId: patch.trackingDeviceId
                ? String(patch.trackingDeviceId).trim()
                : null,
            }
          : {}),
      };
      if (Object.prototype.hasOwnProperty.call(patch, 'gender')) {
        normalized.gender = patch.gender === 'female' ? 'female' : 'male';
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'categoryId')) {
        normalized.categoryId = String(patch.categoryId || 'dog').trim() || 'dog';
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'linkedTracker')) {
        normalized.linkedTracker = Boolean(patch.linkedTracker);
      } else if (Object.prototype.hasOwnProperty.call(normalized, 'trackingDeviceId')) {
        normalized.linkedTracker = Boolean(normalized.trackingDeviceId);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'nfcTag')) {
        normalized.nfcTag = Boolean(patch.nfcTag);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'photoDataUrl')) {
        if (patch.photoDataUrl == null || patch.photoDataUrl === '') {
          normalized.photoDataUrl = null;
        } else if (typeof patch.photoDataUrl === 'string' && patch.photoDataUrl.startsWith('data:')) {
          normalized.photoDataUrl = patch.photoDataUrl;
        }
      }
      applyOptionalTextFields(normalized, patch);
      for (const [key, max] of [
        ['breed', MAX_BREED],
        ['microchipNo', MAX_MICROCHIP],
        ['dateOfBirth', 32],
        ['identifyingMarks', MAX_IDENTIFYING_MARKS],
        ['medicalNotes', MAX_MEDICAL_NOTES],
        ['ownerName', MAX_OWNER_NAME],
        ['ownerPhone', MAX_OWNER_PHONE],
        ['ownerEmail', MAX_OWNER_EMAIL],
      ]) {
        if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
        const v = trimField(patch[key], max);
        if (v) normalized[key] = v;
        else delete normalized[key];
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'friendlyWith')) {
        normalized.friendlyWith = normalizeFriendlyWith(patch.friendlyWith);
      }
      patchPet(uid, id, normalized);
    },
    [uid]
  );

  const removePet = useCallback(
    (id) => {
      deletePet(uid, id);
    },
    [uid]
  );

  const allPets = useMemo(() => {
    const ownIds = new Set(pets.map((p) => p.id));
    const extra = sharedPets.filter((p) => !ownIds.has(p.id));
    return [...pets, ...extra];
  }, [pets, sharedPets]);

  const value = useMemo(
    () => ({
      pets: allPets,
      ownedPets: pets,
      sharedPets,
      addPet,
      updatePet,
      removePet,
      getPet: (id) => allPets.find((p) => p.id === id),
      getCategory: getPetCategory,
    }),
    [allPets, pets, sharedPets, addPet, updatePet, removePet]
  );

  return <PetsContext.Provider value={value}>{children}</PetsContext.Provider>;
}

const GUEST_PETS = {
  pets: [],
  ownedPets: [],
  sharedPets: [],
  addPet: async () => null,
  updatePet: async () => {},
  removePet: async () => {},
  getPet: () => undefined,
  getCategory: getPetCategory,
};

export function usePets() {
  return useContext(PetsContext) || GUEST_PETS;
}

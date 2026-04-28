import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { clearLegacyTraccarDeviceId, loadPetsJson, readLegacyTraccarDeviceId, savePetsJson } from './petsStorage';
import { getPetCategory } from './petCategories';

/**
 * @typedef {{ id: string, name: string, categoryId: string, trackingDeviceId: string | null, createdAt: string, photoDataUrl?: string, colorScheme?: string, description?: string, age?: string }} Pet
 */

const MAX_COLOR_SCHEME = 120;
const MAX_PET_DESCRIPTION = 2000;
const MAX_AGE = 80;

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

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `pet_${crypto.randomUUID()}`;
  return `pet_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function PetsProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [pets, setPets] = useState(/** @type {Pet[]} */ ([]));

  const persist = useCallback(
    (next) => {
      setPets(next);
      if (uid) savePetsJson(uid, JSON.stringify(next));
    },
    [uid]
  );

  useEffect(() => {
    if (!uid) {
      setPets([]);
      return;
    }
    try {
      const raw = loadPetsJson(uid);
      let list = JSON.parse(raw);
      if (!Array.isArray(list)) list = [];
      if (list.length === 0) {
        const legacy = readLegacyTraccarDeviceId();
        if (legacy && legacy.trim()) {
          list = [
            {
              id: newId(),
              name: 'My pet',
              categoryId: 'dog',
              trackingDeviceId: legacy.trim(),
              createdAt: new Date().toISOString(),
            },
          ];
          savePetsJson(uid, JSON.stringify(list));
          clearLegacyTraccarDeviceId();
        }
      }
      setPets(list);
    } catch {
      setPets([]);
    }
  }, [uid]);

  const addPet = useCallback(
    ({
      name,
      categoryId,
      trackingDeviceId = null,
      photoDataUrl = undefined,
      colorScheme = '',
      description = '',
      age = '',
    }) => {
      const n = (name || '').trim();
      if (!n) return;
      const pet = {
        id: newId(),
        name: n,
        categoryId: categoryId || 'dog',
        trackingDeviceId: trackingDeviceId && String(trackingDeviceId).trim() ? String(trackingDeviceId).trim() : null,
        createdAt: new Date().toISOString(),
        ...(typeof photoDataUrl === 'string' && photoDataUrl.startsWith('data:') ? { photoDataUrl } : {}),
      };
      const cs = trimField(colorScheme, MAX_COLOR_SCHEME);
      if (cs) pet.colorScheme = cs;
      const desc = trimField(description, MAX_PET_DESCRIPTION);
      if (desc) pet.description = desc;
      const ageStr = trimField(age, MAX_AGE);
      if (ageStr) pet.age = ageStr;
      persist([...pets, pet]);
    },
    [pets, persist]
  );

  const updatePet = useCallback(
    (id, patch) => {
      persist(
        pets.map((p) => {
          if (p.id !== id) return p;
          const next = {
            ...p,
            ...patch,
            name: patch.name != null ? String(patch.name).trim() : p.name,
            trackingDeviceId:
              patch.trackingDeviceId === undefined
                ? p.trackingDeviceId
                : patch.trackingDeviceId
                  ? String(patch.trackingDeviceId).trim()
                  : null,
          };
          if (Object.prototype.hasOwnProperty.call(patch, 'photoDataUrl')) {
            if (patch.photoDataUrl == null || patch.photoDataUrl === '') {
              delete next.photoDataUrl;
            } else if (typeof patch.photoDataUrl === 'string' && patch.photoDataUrl.startsWith('data:')) {
              next.photoDataUrl = patch.photoDataUrl;
            }
          }
          applyOptionalTextFields(next, patch);
          return next;
        })
      );
    },
    [pets, persist]
  );

  const removePet = useCallback(
    (id) => {
      persist(pets.filter((p) => p.id !== id));
    },
    [pets, persist]
  );

  const value = useMemo(
    () => ({
      pets,
      addPet,
      updatePet,
      removePet,
      getPet: (id) => pets.find((p) => p.id === id),
      getCategory: getPetCategory,
    }),
    [pets, addPet, updatePet, removePet]
  );

  return <PetsContext.Provider value={value}>{children}</PetsContext.Provider>;
}

export function usePets() {
  const ctx = useContext(PetsContext);
  if (!ctx) throw new Error('usePets must be used within PetsProvider');
  return ctx;
}

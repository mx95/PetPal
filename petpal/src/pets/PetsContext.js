import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { clearLegacyTraccarDeviceId, loadPetsJson, readLegacyTraccarDeviceId, savePetsJson } from './petsStorage';
import { getPetCategory } from './petCategories';

/**
 * @typedef {{ id: string, name: string, categoryId: string, trackingDeviceId: string | null, createdAt: string }} Pet
 */

const PetsContext = createContext(null);

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
    ({ name, categoryId, trackingDeviceId = null }) => {
      const n = (name || '').trim();
      if (!n) return;
      const pet = {
        id: newId(),
        name: n,
        categoryId: categoryId || 'dog',
        trackingDeviceId: trackingDeviceId && String(trackingDeviceId).trim() ? String(trackingDeviceId).trim() : null,
        createdAt: new Date().toISOString(),
      };
      persist([...pets, pet]);
    },
    [pets, persist]
  );

  const updatePet = useCallback(
    (id, patch) => {
      persist(
        pets.map((p) =>
          p.id === id
            ? {
                ...p,
                ...patch,
                name: patch.name != null ? String(patch.name).trim() : p.name,
                trackingDeviceId:
                  patch.trackingDeviceId === undefined
                    ? p.trackingDeviceId
                    : patch.trackingDeviceId
                      ? String(patch.trackingDeviceId).trim()
                      : null,
              }
            : p
        )
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

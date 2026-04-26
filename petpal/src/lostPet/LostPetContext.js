import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { usePets } from '../pets/PetsContext';
import {
  loadLostListings,
  loadPremiumUnlocked,
  saveLostListings,
  savePremiumUnlocked,
} from './lostPetStorage';

/**
 * @typedef {Object} LostPetListing
 * @property {string} id
 * @property {string} petId
 * @property {string} petName
 * @property {string} categoryId
 * @property {string|undefined} photoDataUrl
 * @property {string} description
 * @property {string} lastSeenText
 * @property {number|null} lastSeenLat
 * @property {number|null} lastSeenLng
 * @property {string} reward
 * @property {string} contactPhone
 * @property {string} createdAt
 * @property {boolean} active
 */

const LostPetContext = createContext(null);

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `lost_${crypto.randomUUID()}`;
  return `lost_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function LostPetProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { pets } = usePets();
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [listings, setListings] = useState(/** @type {LostPetListing[]} */ ([]));

  useEffect(() => {
    if (!uid) {
      setPremiumUnlocked(false);
      setListings([]);
      return;
    }
    setPremiumUnlocked(loadPremiumUnlocked(uid));
    setListings(loadLostListings(uid));
  }, [uid]);

  const setPremium = useCallback(
    (on) => {
      if (!uid) return;
      setPremiumUnlocked(!!on);
      savePremiumUnlocked(uid, !!on);
    },
    [uid]
  );

  const publishAlert = useCallback(
    (payload) => {
      const pet = pets.find((p) => p.id === payload.petId);
      if (!pet) return { ok: false, error: 'no_pet' };
      const lastLat =
        payload.lastSeenLat != null && String(payload.lastSeenLat).trim() !== ''
          ? Number(payload.lastSeenLat)
          : null;
      const lastLng =
        payload.lastSeenLng != null && String(payload.lastSeenLng).trim() !== ''
          ? Number(payload.lastSeenLng)
          : null;
      const entry = {
        id: newId(),
        petId: pet.id,
        petName: pet.name,
        categoryId: pet.categoryId,
        photoDataUrl: pet.photoDataUrl,
        description: String(payload.description || '').trim().slice(0, 2000),
        lastSeenText: String(payload.lastSeenText || '').trim().slice(0, 1000),
        lastSeenLat: lastLat != null && Number.isFinite(lastLat) ? lastLat : null,
        lastSeenLng: lastLng != null && Number.isFinite(lastLng) ? lastLng : null,
        reward: String(payload.reward || '').trim().slice(0, 200),
        contactPhone: String(payload.contactPhone || '').trim().slice(0, 40),
        createdAt: new Date().toISOString(),
        active: true,
      };
      if (!entry.description) return { ok: false, error: 'description' };
      if (!entry.lastSeenText) return { ok: false, error: 'lastSeen' };
      setListings((prev) => {
        const next = [entry, ...prev];
        if (uid) saveLostListings(uid, next);
        return next;
      });
      return { ok: true };
    },
    [pets, uid]
  );

  const resolveAlert = useCallback(
    (id) => {
      setListings((prev) => {
        const next = prev.map((x) => (x.id === id ? { ...x, active: false } : x));
        if (uid) saveLostListings(uid, next);
        return next;
      });
    },
    [uid]
  );

  const activeListings = useMemo(() => listings.filter((x) => x.active), [listings]);

  const value = useMemo(
    () => ({
      premiumUnlocked,
      setPremium,
      activeListings,
      allListings: listings,
      publishAlert,
      resolveAlert,
    }),
    [premiumUnlocked, setPremium, activeListings, listings, publishAlert, resolveAlert]
  );

  return <LostPetContext.Provider value={value}>{children}</LostPetContext.Provider>;
}

export function useLostPet() {
  const ctx = useContext(LostPetContext);
  if (!ctx) throw new Error('useLostPet must be used within LostPetProvider');
  return ctx;
}

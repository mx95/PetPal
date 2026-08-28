import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { uploadPhotoDrafts } from '../media/scopedPhotoStorage';
import { normalizePrimaryPhoto } from '../media/photoUploadUtils';
import {
  createLostPetAlert,
  fetchLostPetAlertById,
  markLostPetFound,
  migrateLegacyLostPetAlerts,
  reportLostPetAlert,
  subscribeActiveLostPetAlerts,
  subscribeMyLostPetAlerts,
  updateLostPetAlert,
} from './lostPetFirestore';
import { loadLostListings, saveLostListings } from './lostPetStorage';
import { validateLostPetInput } from './lostPetUtils';

const LostPetContext = createContext(null);
const MIGRATION_KEY = 'petpal_lost_pet_migrated_v2';

export function LostPetProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [feedAlerts, setFeedAlerts] = useState(/** @type {import('./lostPetTypes').LostPetAlert[]} */ ([]));
  const [myAlerts, setMyAlerts] = useState(/** @type {import('./lostPetTypes').LostPetAlert[]} */ ([]));
  const [feedError, setFeedError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setFeedError('');
    const offFeed = subscribeActiveLostPetAlerts((rows, err) => {
      setFeedAlerts(rows);
      setFeedError(err?.message || '');
      setLoading(false);
    });

    if (!uid) {
      setMyAlerts([]);
      return () => offFeed();
    }

    let cancelled = false;
    (async () => {
      try {
        const key = `${MIGRATION_KEY}_${uid}`;
        if (!localStorage.getItem(key)) {
          const legacy = loadLostListings(uid);
          if (legacy.length) {
            await migrateLegacyLostPetAlerts(uid, legacy);
            saveLostListings(uid, []);
          }
          localStorage.setItem(key, '1');
        }
      } catch (e) {
        console.warn('[LostPet] legacy migration skipped', e);
      }
      if (cancelled) return;
    })();

    const offMine = subscribeMyLostPetAlerts(uid, (rows) => setMyAlerts(rows));
    return () => {
      cancelled = true;
      offFeed();
      offMine();
    };
  }, [uid]);

  const publishAlert = useCallback(
    async (payload) => {
      if (!uid) return { ok: false, error: 'auth' };
      const v = validateLostPetInput(payload);
      if (!v.ok) return { ok: false, error: v.code };

      const draftId = `draft_${Date.now()}`;
      const normalizedPhotos = normalizePrimaryPhoto(payload.photoDrafts || []);
      const uploaded = await uploadPhotoDrafts(
        normalizedPhotos.map((p) => ({
          file: p.file,
          photoUrl: p.photoUrl,
          storagePath: p.storagePath,
          isPrimary: p.isPrimary,
        })),
        { uid, scope: 'lostPetPhotos', entityId: draftId }
      );
      if (!uploaded.length) return { ok: false, error: 'photo_upload' };

      const result = await createLostPetAlert(uid, {
        petId: payload.petId,
        petName: payload.petName,
        categoryId: payload.categoryId,
        breed: payload.breed,
        description: payload.description,
        identifyingMarks: payload.identifyingMarks,
        lastSeenText: payload.lastSeenText,
        lastSeenAt: payload.lastSeenAt,
        lastSeenLat: payload.lastSeenLat,
        lastSeenLng: payload.lastSeenLng,
        reward: payload.reward,
        contactPhone: payload.contactPhone,
        additionalInfo: payload.additionalInfo,
        photos: uploaded,
      });
      if (!result.ok) return { ok: false, error: result.reason || 'save_failed' };
      return { ok: true, id: result.id };
    },
    [uid]
  );

  const resolveAlert = useCallback(
    async (id) => {
      if (!uid) return { ok: false };
      return markLostPetFound(id, uid);
    },
    [uid]
  );

  const reportAlert = useCallback(
    async (id) => {
      if (!uid) return { ok: false };
      return reportLostPetAlert(id, uid);
    },
    [uid]
  );

  const getAlertById = useCallback(async (id) => fetchLostPetAlertById(id), []);

  const editAlert = useCallback(
    async (id, patch) => {
      if (!uid) return { ok: false };
      let photos;
      if (patch.photoDrafts) {
        const normalized = normalizePrimaryPhoto(patch.photoDrafts);
        photos = await uploadPhotoDrafts(
          normalized.map((p) => ({
            file: p.file,
            photoUrl: p.photoUrl,
            storagePath: p.storagePath,
            isPrimary: p.isPrimary,
          })),
          { uid, scope: 'lostPetPhotos', entityId: id }
        );
      }
      return updateLostPetAlert(id, uid, { ...patch, photos });
    },
    [uid]
  );

  const activeListings = feedAlerts;
  const myActiveAlerts = useMemo(() => myAlerts.filter((a) => a.status === 'active' || a.status === 'reported'), [myAlerts]);

  const value = useMemo(
    () => ({
      loading,
      feedError,
      activeListings,
      myAlerts,
      myActiveAlerts,
      publishAlert,
      resolveAlert,
      reportAlert,
      editAlert,
      getAlertById,
    }),
    [
      loading,
      feedError,
      activeListings,
      myAlerts,
      myActiveAlerts,
      publishAlert,
      resolveAlert,
      reportAlert,
      editAlert,
      getAlertById,
    ]
  );

  return <LostPetContext.Provider value={value}>{children}</LostPetContext.Provider>;
}

export function useLostPet() {
  const ctx = useContext(LostPetContext);
  if (!ctx) throw new Error('useLostPet must be used within LostPetProvider');
  return ctx;
}

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
import { normalizeTrackerImei, syncTrackerImeiIndex } from '../tracking/trackerImeiIndex';
import { linkTrackerSubscriptionPet } from '../shop/subscriptionImeiClient';

function petsCol(uid) {
  return collection(getDb(), 'users', uid, 'pets');
}

function publicPetsCol() {
  return collection(getDb(), 'publicPets');
}

function buildPublicPetPayload(uid, petId, x) {
  const friendlyArr = Array.isArray(x?.friendlyWith) ? x.friendlyWith.map((v) => String(v || '')) : [];
  return {
    ownerUid: uid,
    petId,
    name: String(x?.name || ''),
    breed: typeof x?.breed === 'string' ? x.breed : '',
    gender: typeof x?.gender === 'string' ? x.gender : 'male',
    dateOfBirth: typeof x?.dateOfBirth === 'string' ? x.dateOfBirth : '',
    colorScheme: typeof x?.colorScheme === 'string' ? x.colorScheme : '',
    microchipNo: typeof x?.microchipNo === 'string' ? x.microchipNo : '',
    identifyingMarks: typeof x?.identifyingMarks === 'string' ? x.identifyingMarks : '',
    medicalNotes: typeof x?.medicalNotes === 'string' ? x.medicalNotes : '',
    veterinarian: typeof x?.veterinarian === 'string' ? x.veterinarian : '',
    photoUrl: typeof x?.photoUrl === 'string' ? x.photoUrl : '',
    ownerName: typeof x?.ownerName === 'string' ? x.ownerName : '',
    ownerPhone: typeof x?.ownerPhone === 'string' ? x.ownerPhone : '',
    ownerEmail: typeof x?.ownerEmail === 'string' ? x.ownerEmail : '',
    ownerLocation: typeof x?.ownerLocation === 'string' ? x.ownerLocation : '',
    ownerMapsQuery: typeof x?.ownerMapsQuery === 'string' ? x.ownerMapsQuery : '',
    vetName: typeof x?.vetName === 'string' ? x.vetName : '',
    vetPhone: typeof x?.vetPhone === 'string' ? x.vetPhone : '',
    vetEmail: typeof x?.vetEmail === 'string' ? x.vetEmail : '',
    vetLocation: typeof x?.vetLocation === 'string' ? x.vetLocation : '',
    vetMapsQuery: typeof x?.vetMapsQuery === 'string' ? x.vetMapsQuery : '',
    owner: {
      name: typeof x?.ownerName === 'string' ? x.ownerName : '',
      phone1: typeof x?.ownerPhone === 'string' ? x.ownerPhone : '',
      email: typeof x?.ownerEmail === 'string' ? x.ownerEmail : '',
      location: typeof x?.ownerLocation === 'string' ? x.ownerLocation : '',
      mapsQuery: typeof x?.ownerMapsQuery === 'string' ? x.ownerMapsQuery : '',
    },
    vet: {
      name: typeof x?.vetName === 'string' ? x.vetName : '',
      phone1: typeof x?.vetPhone === 'string' ? x.vetPhone : '',
      email: typeof x?.vetEmail === 'string' ? x.vetEmail : '',
      location: typeof x?.vetLocation === 'string' ? x.vetLocation : '',
      mapsQuery: typeof x?.vetMapsQuery === 'string' ? x.vetMapsQuery : '',
    },
    friendlyWith: friendlyArr,
    updatedAt: serverTimestamp(),
  };
}

function tsToIso(v) {
  if (!v) return '';
  try {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
  } catch {
    // ignore
  }
  return '';
}

export function subscribePets(uid, onNext, onError) {
  if (!isFirebaseConfigured() || !uid) {
    onNext([]);
    return () => {};
  }
  const q = query(petsCol(uid), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          name: String(x.name || ''),
          categoryId: String(x.categoryId || 'dog'),
          trackingDeviceId: x.trackingDeviceId ? String(x.trackingDeviceId) : null,
          createdAt: tsToIso(x.createdAt) || new Date().toISOString(),
          ...(typeof x.photoDataUrl === 'string' ? { photoDataUrl: x.photoDataUrl } : {}),
          ...(typeof x.colorScheme === 'string' ? { colorScheme: x.colorScheme } : {}),
          ...(typeof x.description === 'string' ? { description: x.description } : {}),
          ...(typeof x.age === 'string' ? { age: x.age } : {}),
          ...(Array.isArray(x.friendlyWith) ? { friendlyWith: x.friendlyWith.map((v) => String(v || '')) } : {}),
          ...(typeof x.breed === 'string' ? { breed: x.breed } : {}),
          ...(typeof x.microchipNo === 'string' ? { microchipNo: x.microchipNo } : {}),
          ...(typeof x.dateOfBirth === 'string' ? { dateOfBirth: x.dateOfBirth } : {}),
          ...(typeof x.identifyingMarks === 'string' ? { identifyingMarks: x.identifyingMarks } : {}),
          ...(typeof x.medicalNotes === 'string' ? { medicalNotes: x.medicalNotes } : {}),
          ...(typeof x.ownerName === 'string' ? { ownerName: x.ownerName } : {}),
          ...(typeof x.ownerPhone === 'string' ? { ownerPhone: x.ownerPhone } : {}),
          ...(typeof x.ownerEmail === 'string' ? { ownerEmail: x.ownerEmail } : {}),
          ...(typeof x.photoUrl === 'string' ? { photoUrl: x.photoUrl } : {}),
          ...(typeof x.photoStoragePath === 'string' ? { photoStoragePath: x.photoStoragePath } : {}),
          ...(typeof x.nfcTag === 'boolean' ? { nfcTag: x.nfcTag } : { nfcTag: false }),
          ...(typeof x.linkedTracker === 'boolean'
            ? { linkedTracker: x.linkedTracker }
            : { linkedTracker: Boolean(x.trackingDeviceId) }),
          ...(typeof x.publicProfileId === 'string' ? { publicProfileId: x.publicProfileId } : {}),
          gender: x.gender === 'female' ? 'female' : 'male',
        };
      });
      onNext(rows);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function createPet(uid, pet) {
  if (!isFirebaseConfigured() || !uid) return;
  const publicRef = doc(publicPetsCol());
  const trackingDeviceId = normalizeTrackerImei(pet.trackingDeviceId) || null;
  const payload = {
    ...pet,
    ...(trackingDeviceId ? { trackingDeviceId } : {}),
    publicProfileId: publicRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const refDoc = await addDoc(petsCol(uid), payload);

  await setDoc(publicRef, buildPublicPetPayload(uid, refDoc.id, pet));
  if (trackingDeviceId) {
    await syncTrackerImeiIndex(uid, refDoc.id, pet.name, null, trackingDeviceId);
  }
  return refDoc.id;
}

export async function patchPet(uid, petId, patch) {
  if (!isFirebaseConfigured() || !uid || !petId) return;
  const petRef = doc(getDb(), 'users', uid, 'pets', petId);
  const beforeSnap = await getDoc(petRef);
  const before = beforeSnap.exists() ? beforeSnap.data() || {} : {};

  const nextPatch = { ...patch, updatedAt: serverTimestamp() };
  if (Object.prototype.hasOwnProperty.call(patch, 'trackingDeviceId')) {
    const normalized = normalizeTrackerImei(patch.trackingDeviceId);
    nextPatch.trackingDeviceId = normalized || null;
  }

  await updateDoc(petRef, nextPatch);

  if (Object.prototype.hasOwnProperty.call(patch, 'trackingDeviceId')) {
    const nextName =
      typeof patch.name === 'string' && patch.name.trim()
        ? patch.name.trim()
        : String(before.name || '').trim();
    await syncTrackerImeiIndex(
      uid,
      petId,
      nextName,
      before.trackingDeviceId,
      nextPatch.trackingDeviceId
    );
    if (nextPatch.trackingDeviceId) {
      try {
        await linkTrackerSubscriptionPet({
          petId,
          imei: nextPatch.trackingDeviceId,
        });
      } catch {
        // No matching subscription yet (e.g. IMEI not assigned after shipment).
      }
    }
  }

  const snap = await getDoc(petRef);
  if (snap.exists()) {
    const current = snap.data() || {};
    let publicId = typeof current.publicProfileId === 'string' && current.publicProfileId.trim() ? current.publicProfileId : '';
    if (!publicId) {
      publicId = doc(publicPetsCol()).id;
      await updateDoc(petRef, {
        publicProfileId: publicId,
        updatedAt: serverTimestamp(),
      });
    }

    await setDoc(doc(getDb(), 'publicPets', publicId), buildPublicPetPayload(uid, petId, current), { merge: true });
  }
}

export async function deletePet(uid, petId) {
  if (!isFirebaseConfigured() || !uid || !petId) return;
  const petRef = doc(getDb(), 'users', uid, 'pets', petId);
  const snap = await getDoc(petRef);
  const data = snap.exists() ? snap.data() || {} : {};
  await deleteDoc(petRef);
  if (snap.exists()) {
    await syncTrackerImeiIndex(uid, petId, data.name, data.trackingDeviceId, null);
    const publicId = data.publicProfileId;
    if (typeof publicId === 'string' && publicId.trim()) {
      await deleteDoc(doc(getDb(), 'publicPets', publicId));
    }
  }
}

export async function syncOwnerContactToPets(uid, ownerPatch) {
  if (!isFirebaseConfigured() || !uid) return;

  const normalized = {
    ownerName: typeof ownerPatch?.ownerName === 'string' ? ownerPatch.ownerName : '',
    ownerPhone: typeof ownerPatch?.ownerPhone === 'string' ? ownerPatch.ownerPhone : '',
    ownerEmail: typeof ownerPatch?.ownerEmail === 'string' ? ownerPatch.ownerEmail : '',
    ownerLocation: typeof ownerPatch?.ownerLocation === 'string' ? ownerPatch.ownerLocation : '',
    ownerMapsQuery: typeof ownerPatch?.ownerMapsQuery === 'string' ? ownerPatch.ownerMapsQuery : '',
  };

  const db = getDb();
  const snap = await getDocs(petsCol(uid));
  if (snap.empty) return;

  const batch = writeBatch(db);

  snap.docs.forEach((petDoc) => {
    const petData = petDoc.data() || {};
    const petRef = doc(db, 'users', uid, 'pets', petDoc.id);

    const publicId =
      typeof petData.publicProfileId === 'string' && petData.publicProfileId.trim()
        ? petData.publicProfileId.trim()
        : '';

    const nextPublicId = publicId || doc(publicPetsCol()).id;

    batch.set(
      petRef,
      {
        publicProfileId: nextPublicId,
        ...normalized,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(
      doc(db, 'publicPets', nextPublicId),
      {
        ownerName: normalized.ownerName,
        ownerPhone: normalized.ownerPhone,
        ownerEmail: normalized.ownerEmail,
        ownerLocation: normalized.ownerLocation,
        ownerMapsQuery: normalized.ownerMapsQuery,
        owner: {
          name: normalized.ownerName,
          phone1: normalized.ownerPhone,
          email: normalized.ownerEmail,
          location: normalized.ownerLocation,
          mapsQuery: normalized.ownerMapsQuery,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
}

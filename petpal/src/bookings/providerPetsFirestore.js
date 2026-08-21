import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
function clientPetsCol(companyId) {
  return collection(getDb(), 'companies', companyId, 'clientPets');
}

export function subscribeClientPets(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext([]);
    return () => {};
  }
  const q = query(clientPetsCol(companyId), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => (onError ? onError(err) : undefined)
  );
}

export async function createClientPet(companyId, pet) {
  if (!isFirebaseConfigured() || !companyId) return;
  const payload = {
    name: String(pet?.name || '').trim().slice(0, 120),
    ownerName: pet?.ownerName ? String(pet.ownerName).trim().slice(0, 120) : '',
    ownerPhone: pet?.ownerPhone ? String(pet.ownerPhone).trim().slice(0, 40) : '',
    notes: pet?.notes ? String(pet.notes).slice(0, 800) : '',
    trackingImei: pet?.trackingImei ? String(pet.trackingImei).trim().slice(0, 30) : '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (!payload.name) throw new Error('pet_name_required');
  const ref = await addDoc(clientPetsCol(companyId), payload);
  return ref.id;
}

export async function patchClientPet(companyId, petId, patch) {
  if (!isFirebaseConfigured() || !companyId || !petId) return;
  await updateDoc(doc(getDb(), 'companies', companyId, 'clientPets', petId), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteClientPet(companyId, petId) {
  if (!isFirebaseConfigured() || !companyId || !petId) return;
  await deleteDoc(doc(getDb(), 'companies', companyId, 'clientPets', petId));
}


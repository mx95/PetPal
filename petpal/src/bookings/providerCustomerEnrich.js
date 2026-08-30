import { doc, getDoc } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

/**
 * Fill missing name/email/photo from public user + pet docs (legacy bookings).
 * @param {import('./providerCustomerUtils').aggregateCustomersFromBookings extends (...args: infer _) => infer R ? R : never} customers
 */
export async function enrichCustomersFromDirectory(customers) {
  if (!isFirebaseConfigured() || !customers.length) return customers;

  const db = getDb();
  const next = await Promise.all(
    customers.map(async (row) => {
      if (!row.customerUid || row.isWalkIn) return row;

      const out = { ...row };
      const needsUser = !out.customerEmail || !out.customerPhotoUrl || out.customerName.includes('…');

      if (needsUser) {
        try {
          const userSnap = await getDoc(doc(db, 'users', row.customerUid));
          if (userSnap.exists()) {
            const data = userSnap.data() || {};
            if (!out.customerEmail && data.email) out.customerEmail = String(data.email);
            if ((!out.customerName || out.customerName.includes('…')) && data.accountName) {
              out.customerName = String(data.accountName);
            }
            if (!out.customerPhotoUrl && data.profilePhotoUrl) {
              out.customerPhotoUrl = String(data.profilePhotoUrl);
            }
          }
        } catch {
          /* ignore — show whatever snapshot we have */
        }
      }

      if (!out.petPhotoUrl && out.petId && out.customerUid) {
        try {
          const petSnap = await getDoc(doc(db, 'users', row.customerUid, 'pets', row.petId));
          if (petSnap.exists()) {
            const pet = petSnap.data() || {};
            if (pet.photoUrl) out.petPhotoUrl = String(pet.photoUrl);
            else if (pet.photoDataUrl) out.petPhotoUrl = String(pet.photoDataUrl);
            if (pet.categoryId) out.petCategoryId = String(pet.categoryId);
          }
        } catch {
          /* ignore */
        }
      }

      return out;
    })
  );

  return next;
}

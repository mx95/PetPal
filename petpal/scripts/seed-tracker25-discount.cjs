#!/usr/bin/env node
/**
 * Seeds (or refreshes) the TRACKER25 discount code:
 *   TRACKER_HARDWARE list €39.99 → charge €25.00 (fixed €14.99 / 1499¢ off).
 * Scoped to TRACKER_HARDWARE only so Plus/NFC carts are unaffected.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=petpal-aecda node scripts/seed-tracker25-discount.cjs
 */
const admin = require('firebase-admin');

const CODE = 'TRACKER25';
const TRACKER_LIST_CENTS = 3999;
const TARGET_CHARGE_CENTS = 2500;
const FIXED_OFF_CENTS = TRACKER_LIST_CENTS - TARGET_CHARGE_CENTS; // 1499

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'petpal-aecda';
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();
  const ref = db.collection('discountCodes').doc(CODE);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const existing = await ref.get();

  const payload = {
    code: CODE,
    type: 'fixed',
    amount: FIXED_OFF_CENTS,
    active: true,
    appliesToSkus: ['TRACKER_HARDWARE'],
    note: 'GPS tracker hardware €39.99 → €25.00 (fixed €14.99 off)',
    updatedAt: now,
  };
  if (!existing.exists) {
    payload.createdAt = now;
    payload.createdBy = 'seed-tracker25-discount';
  }

  await ref.set(payload, { merge: true });
  const after = await ref.get();
  const data = after.data() || {};
  console.log(
    JSON.stringify(
      {
        ok: true,
        code: CODE,
        type: data.type,
        amountCents: data.amount,
        chargeTrackerCents: TRACKER_LIST_CENTS - Number(data.amount),
        active: data.active === true,
        appliesToSkus: data.appliesToSkus || null,
        created: !existing.exists,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Seeds NOV2026PETS: GPS tracker €39.99 → €25.00 (fixed €14.99 / 1499¢ off).
 * Limited to 10 successful paid uses (maxUses).
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=petpal-aecda node scripts/seed-nov2026pets-discount.cjs
 */
const admin = require('firebase-admin');

const CODE = 'NOV2026PETS';
const TRACKER_LIST_CENTS = 3999;
const TARGET_CHARGE_CENTS = 2500;
const FIXED_OFF_CENTS = TRACKER_LIST_CENTS - TARGET_CHARGE_CENTS; // 1499
const MAX_USES = 10;

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'petpal-aecda';
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();
  const ref = db.collection('discountCodes').doc(CODE);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const existing = await ref.get();
  const existingData = existing.exists ? existing.data() || {} : {};

  const payload = {
    code: CODE,
    type: 'fixed',
    amount: FIXED_OFF_CENTS,
    active: true,
    appliesToSkus: ['TRACKER_HARDWARE'],
    maxUses: MAX_USES,
    usedCount: Math.max(0, Math.floor(Number(existingData.usedCount) || 0)),
    note: 'Nov 2026 10-user promo: GPS tracker €39.99 → €25.00 (max 10 paid uses)',
    updatedAt: now,
  };
  if (!existing.exists) {
    payload.createdAt = now;
    payload.createdBy = 'seed-nov2026pets-discount';
    payload.usedCount = 0;
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
        maxUses: data.maxUses ?? null,
        usedCount: data.usedCount ?? 0,
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

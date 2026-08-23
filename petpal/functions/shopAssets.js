const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

async function assertAdmin(uid) {
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  }
  const snap = await admin.firestore().doc(`admins/${uid}`).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }
}

function buildDownloadUrl(bucketName, path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

exports.uploadShopAsset = functions.region('europe-west1').https.onCall(async (data, context) => {
  await assertAdmin(context.auth?.uid);

  const kind = data?.kind === 'tracker' ? 'tracker' : 'nfc';
  const designId = Math.max(1, Number(data?.designId) || 1);
  const imageBase64 = String(data?.imageBase64 || '').trim();
  if (!imageBase64) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing image data.');
  }

  let buffer;
  try {
    buffer = Buffer.from(imageBase64, 'base64');
  } catch {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid image data.');
  }

  if (!buffer.length) {
    throw new functions.https.HttpsError('invalid-argument', 'Empty image.');
  }
  if (buffer.length > 3 * 1024 * 1024) {
    throw new functions.https.HttpsError('invalid-argument', 'Image must be under 3 MB.');
  }

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path =
    kind === 'tracker' ? `shopAssets/tracker-${stamp}.jpg` : `shopAssets/nfc/${designId}-${stamp}.jpg`;
  const token = crypto.randomUUID();
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return {
    url: buildDownloadUrl(bucket.name, path, token),
    path,
  };
});

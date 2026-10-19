"use strict";

const fs = require("fs");
const path = require("path");
const { buildPushText, normalizeLang } = require("./messages");

const RESOLVE_TTL_MS = 60 * 1000;
const NEGATIVE_TTL_MS = 5 * 60 * 1000;
const APP_URL = process.env.PETPAL_APP_URL || "https://petpal.com.cy";
const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

const DEFAULT_PREFS = { push: true, zone: true, battery: true, sos: true, offline: true };

function findServiceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    "/root/serviceAccount.json",
    path.join(__dirname, "..", "..", "..", "petpal", "serviceAccount.json"),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Normalises the stored safe-zone doc; returns null when it can't drive alerts. */
function parseZone(data) {
  if (!data || typeof data !== "object") return null;
  const lat = finiteNumber(data.lat);
  const lng = finiteNumber(data.lng);
  const radiusM = finiteNumber(data.radiusM);
  if (lat == null || lng == null || radiusM == null || radiusM <= 0) return null;
  return {
    enabled: data.enabled !== false,
    lat,
    lng,
    radiusM,
    notifyExit: data.notifyExit !== false,
    notifyEnter: data.notifyEnter !== false,
  };
}

function parsePrefs(data) {
  const out = { ...DEFAULT_PREFS };
  if (data && typeof data === "object") {
    for (const key of Object.keys(DEFAULT_PREFS)) {
      if (data[key] === false) out[key] = false;
    }
  }
  return out;
}

/**
 * Firestore + FCM delivery used by the alert engine. Returns null when Firebase Admin cannot start
 * (no service account / package), so tracker ingest keeps working without alerts.
 */
function createFirebaseGateway({ logger = console, now = Date.now, admin: injectedAdmin = null } = {}) {
  let admin = injectedAdmin;
  if (!admin) {
    const credentialPath = findServiceAccountPath();
    if (!credentialPath) {
      logger.warn("[alerts] No Firebase service account found — alerts disabled");
      return null;
    }
    try {
      // eslint-disable-next-line global-require
      admin = require("firebase-admin");
      if (!admin.apps.length) {
        const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      }
    } catch (err) {
      logger.warn(`[alerts] Firebase Admin failed to start — alerts disabled: ${err?.message || err}`);
      return null;
    }
  }

  const db = admin.firestore();
  const messaging = admin.messaging();
  const FieldValue = admin.firestore.FieldValue;
  const cache = new Map();

  async function lookupOwner(imei) {
    const indexSnap = await db.collection("trackerImeiIndex").doc(imei).get();
    if (indexSnap.exists) {
      const row = indexSnap.data() || {};
      if (row.uid && row.petId) {
        return { uid: String(row.uid), petId: String(row.petId), petName: String(row.petName || "").trim() };
      }
    }
    const values = [imei];
    const asNumber = Number(imei);
    if (Number.isSafeInteger(asNumber)) values.push(asNumber);
    const snap = await db.collectionGroup("pets").where("trackingDeviceId", "in", values).limit(1).get();
    if (snap.empty) return null;
    const petDoc = snap.docs[0];
    const uid = petDoc.ref.parent.parent?.id;
    if (!uid) return null;
    return { uid, petId: petDoc.id, petName: String(petDoc.data()?.name || "").trim() };
  }

  async function resolve(imei) {
    const key = String(imei);
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.value;

    let value = null;
    try {
      const owner = await lookupOwner(key);
      if (owner) {
        const userRef = db.collection("users").doc(owner.uid);
        const [petSnap, zoneSnap, prefsSnap] = await Promise.all([
          userRef.collection("pets").doc(owner.petId).get(),
          userRef.collection("safeZones").doc(owner.petId).get(),
          userRef.collection("settings").doc("notifications").get(),
        ]);
        const petName = String(petSnap.data()?.name || owner.petName || "").trim();
        value = {
          uid: owner.uid,
          petId: owner.petId,
          petName,
          imei: key,
          zone: zoneSnap.exists ? parseZone(zoneSnap.data()) : null,
          prefs: parsePrefs(prefsSnap.exists ? prefsSnap.data() : null),
        };
      }
    } catch (err) {
      logger.warn(`[alerts] owner lookup failed for ${key}: ${err?.message || err}`);
      cache.set(key, { value: hit?.value ?? null, expires: now() + 15 * 1000 });
      return hit?.value ?? null;
    }
    cache.set(key, { value, expires: now() + (value ? RESOLVE_TTL_MS : NEGATIVE_TTL_MS) });
    return value;
  }

  async function addNotification(uid, payload) {
    await db.collection("users").doc(uid).collection("notifications").add({
      type: payload.type,
      imei: payload.imei,
      petId: payload.petId,
      petName: payload.petName || "",
      params: payload.params || {},
      lat: payload.lat,
      lng: payload.lng,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  async function sendPush(uid, payload) {
    const tokensRef = db.collection("users").doc(uid).collection("pushTokens");
    const snap = await tokensRef.get();
    if (snap.empty) return;

    const byLang = new Map();
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      if (!data.token) continue;
      const lang = normalizeLang(data.lang);
      if (!byLang.has(lang)) byLang.set(lang, []);
      byLang.get(lang).push({ ref: doc.ref, token: String(data.token) });
    }

    const link = `${APP_URL}/tracking`;
    for (const [lang, rows] of byLang) {
      const { title, body } = buildPushText(payload.type, lang, payload.params);
      const messages = rows.map(({ token }) => ({
        token,
        data: {
          type: payload.type,
          petId: String(payload.petId || ""),
          title,
          body,
          link,
        },
        webpush: {
          headers: { Urgency: "high", TTL: "3600" },
        },
      }));
      const result = await messaging.sendEach(messages);
      await Promise.all(
        result.responses.map(async (response, index) => {
          if (response.success) return;
          const code = response.error?.code;
          if (INVALID_TOKEN_CODES.has(code)) {
            await rows[index].ref.delete().catch(() => {});
          } else {
            logger.warn(`[alerts] push failed (${code || "unknown"}) for ${uid}`);
          }
        })
      );
    }
  }

  return { resolve, addNotification, sendPush, _cache: cache };
}

module.exports = { createFirebaseGateway, parseZone, parsePrefs };

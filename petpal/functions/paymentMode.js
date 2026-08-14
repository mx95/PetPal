/**
 * Payment mode (test|live) + JCC credential slots in Firestore.
 * Shared by Cloud Functions callables and jccPayments credential resolution.
 */

const admin = require('firebase-admin');

const DEFAULT_TEST_REST = 'https://gateway-test.jcc.com.cy/payment/rest';
const DEFAULT_LIVE_REST = 'https://gateway.jcc.com.cy/payment/rest';

function normalizeMode(raw) {
  return String(raw || '').trim().toLowerCase() === 'live' ? 'live' : 'test';
}

function maskUser(user) {
  const s = String(user || '').trim();
  if (!s) return '';
  if (s.includes('@')) return `${s.slice(0, 2)}…${s.slice(s.indexOf('@'))}`;
  if (s.length <= 4) return `${s.slice(0, 1)}…`;
  return `${s.slice(0, 2)}…${s.slice(-2)}`;
}

function restHost(restBase) {
  try {
    return new URL(String(restBase || '')).host || '';
  } catch {
    return String(restBase || '').replace(/^https?:\/\//, '').split('/')[0] || '';
  }
}

function slotConfigured(slot) {
  return Boolean(slot && String(slot.user || '').trim() && String(slot.pass || '').trim());
}

async function readSiteModeDoc(db) {
  const snap = await db.doc('adminConfig/site').get();
  const data = snap.exists ? snap.data() || {} : {};
  return {
    mode: normalizeMode(data.mode),
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || null,
  };
}

async function readJccSlots(db) {
  const snap = await db.doc('adminConfig/jcc').get();
  const data = snap.exists ? snap.data() || {} : {};
  return {
    test: data.test && typeof data.test === 'object' ? data.test : {},
    live: data.live && typeof data.live === 'object' ? data.live : {},
  };
}

function publicSlotStatus(slot, fallbackRest) {
  const configured = slotConfigured(slot);
  const restBase = String(slot.restBase || fallbackRest || '').trim().replace(/\/$/, '');
  return {
    configured,
    userMasked: configured ? maskUser(slot.user) : '',
    restBase: restBase || fallbackRest,
    restHost: restHost(restBase || fallbackRest),
  };
}

async function getPaymentMode(db) {
  const site = await readSiteModeDoc(db);
  return site.mode;
}

module.exports = {
  DEFAULT_TEST_REST,
  DEFAULT_LIVE_REST,
  normalizeMode,
  maskUser,
  restHost,
  slotConfigured,
  readSiteModeDoc,
  readJccSlots,
  publicSlotStatus,
  getPaymentMode,
};

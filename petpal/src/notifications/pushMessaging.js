import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getFirebaseApp, isFirebaseConfigured } from '../firebase';
import { deletePushToken, savePushToken } from './notificationsFirestore';

const LOCAL_TOKEN_KEY = 'petpal_push_token';
const SW_URL = '/firebase-messaging-sw.js';

function readLocalToken() {
  try {
    return localStorage.getItem(LOCAL_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function writeLocalToken(token) {
  try {
    if (token) localStorage.setItem(LOCAL_TOKEN_KEY, token);
    else localStorage.removeItem(LOCAL_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** True when this browser can receive web push (iOS needs the app installed to the home screen). */
export async function isPushSupported() {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/** iOS Safari outside an installed PWA cannot use web push; used to show an install hint. */
export function isIosNeedingInstall() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  return isIos && !standalone;
}

export function getPushPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export function hasLocalPushToken() {
  return Boolean(readLocalToken());
}

async function obtainToken() {
  const registration = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY?.trim();
  return getToken(getMessaging(getFirebaseApp()), {
    serviceWorkerRegistration: registration,
    ...(vapidKey ? { vapidKey } : {}),
  });
}

/**
 * Asks for permission (must run from a user gesture), registers the service worker and stores the FCM token.
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'unsupported' | 'denied' | 'failed' }>}
 */
export async function enablePush(uid, lang) {
  if (!uid || !(await isPushSupported())) return { ok: false, reason: 'unsupported' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };
    const token = await obtainToken();
    if (!token) return { ok: false, reason: 'failed' };
    await savePushToken(uid, token, lang);
    writeLocalToken(token);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export async function disablePush(uid) {
  const token = readLocalToken();
  writeLocalToken('');
  try {
    if (token && uid) await deletePushToken(uid, token);
    if (await isPushSupported()) await deleteToken(getMessaging(getFirebaseApp()));
  } catch {
    // token already gone
  }
}

/** Keeps the stored token fresh and its language in sync after login or a language change. */
export async function syncPush(uid, lang) {
  if (!uid || !hasLocalPushToken() || getPushPermission() !== 'granted') return;
  if (!(await isPushSupported())) return;
  try {
    const token = await obtainToken();
    if (!token) return;
    const previous = readLocalToken();
    if (previous && previous !== token) await deletePushToken(uid, previous).catch(() => {});
    await savePushToken(uid, token, lang);
    writeLocalToken(token);
  } catch {
    // retried on next load
  }
}

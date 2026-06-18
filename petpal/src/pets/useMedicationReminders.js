import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { usePets } from './PetsContext';
import { useI18n } from '../i18n/I18nContext';
import { subscribePetMedications } from './petMedicationsFirestore';
import { isFirebaseConfigured } from '../firebase';

const REMINDER_STORAGE_KEY = 'petpal_med_reminders_v1';
const CHECK_MS = 30 * 1000;

function loadSentToday() {
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveSentToday(map) {
  try {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseTimeToTodayMs(hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}

async function ensureNotificationPermission() {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const r = await Notification.requestPermission();
    return r === 'granted';
  } catch {
    return false;
  }
}

function fireReminder({ petName, medName, pillCount, t }) {
  const title = t('myPets.medReminderTitle', { pet: petName });
  const body =
    pillCount > 1
      ? t('myPets.medReminderBodyPlural', { med: medName, count: pillCount })
      : t('myPets.medReminderBody', { med: medName });
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: `med-${petName}-${medName}` });
      return;
    } catch {
      // fall through
    }
  }
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n${body}`);
  }
}

/**
 * Poll medication schedules and notify at dose times (browser notifications).
 */
export function useMedicationReminders() {
  const { user } = useAuth();
  const { pets } = usePets();
  const { t } = useI18n();
  const medsRef = useRef([]);
  const askedPermissionRef = useRef(false);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user?.uid || !pets.length) {
      medsRef.current = [];
      return undefined;
    }

    const unsubs = pets.map((pet) =>
      subscribePetMedications(
        user.uid,
        pet.id,
        (rows) => {
          medsRef.current = [
            ...medsRef.current.filter((x) => x.petId !== pet.id),
            ...rows.map((r) => ({ ...r, petId: pet.id, petName: pet.name || 'Pet' })),
          ];
        },
        () => {}
      )
    );

    return () => {
      unsubs.forEach((u) => u());
      medsRef.current = [];
    };
  }, [user?.uid, pets]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user?.uid) return undefined;

    const tick = () => {
      const now = Date.now();
      const day = todayKey();
      const sent = loadSentToday();
      if (!sent[day]) sent[day] = {};

      for (const med of medsRef.current) {
        const times = Array.isArray(med.times) ? med.times : [med.time || '09:00'];
        for (const timeVal of times) {
          const targetMs = parseTimeToTodayMs(timeVal);
          if (targetMs == null) continue;
          const delta = now - targetMs;
          if (delta < 0 || delta > 90 * 1000) continue;
          const key = `${med.petId}|${med.id}|${timeVal}|${day}`;
          if (sent[day][key]) continue;
          sent[day][key] = true;
          saveSentToday(sent);
          if (!askedPermissionRef.current) {
            askedPermissionRef.current = true;
            void ensureNotificationPermission();
          }
          fireReminder({
            petName: med.petName,
            medName: med.name,
            pillCount: med.pillCount || 1,
            t,
          });
        }
      }
    };

    const id = window.setInterval(tick, CHECK_MS);
    tick();
    return () => window.clearInterval(id);
  }, [user?.uid, t]);
}

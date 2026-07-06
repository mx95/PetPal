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
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../../firebase';
import { DEFAULT_SCHEDULING_SETTINGS } from './availabilityEngine';

function col(companyId, name) {
  return collection(getDb(), 'companies', companyId, name);
}

function mapDoc(d) {
  return { id: d.id, ...d.data() };
}

export function defaultWeeklyRule(overrides = {}) {
  return {
    recurrenceType: 'weekly',
    daysOfWeek: [1, 2, 3, 4, 5],
    periods: [{ startTime: '09:00', endTime: '17:00' }],
    effectiveMode: 'forever',
    effectiveFrom: null,
    effectiveTo: null,
    serviceId: null,
    employeeId: null,
    active: true,
    ...overrides,
  };
}

export async function fetchSchedulingSettings(companyId) {
  if (!isFirebaseConfigured() || !companyId) return { ...DEFAULT_SCHEDULING_SETTINGS };
  const snap = await getDoc(doc(getDb(), 'providers', companyId));
  const data = snap.exists() ? snap.data() : {};
  return { ...DEFAULT_SCHEDULING_SETTINGS, ...(data.schedulingSettings || {}) };
}

export async function saveSchedulingSettings(companyId, patch) {
  if (!isFirebaseConfigured() || !companyId) return;
  const current = await fetchSchedulingSettings(companyId);
  await setDoc(
    doc(getDb(), 'providers', companyId),
    {
      schedulingSettings: { ...current, ...patch },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeAvailabilityRules(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext([]);
    return () => {};
  }
  const q = query(col(companyId, 'availabilityRules'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map(mapDoc)),
    (err) => (onError ? onError(err) : undefined)
  );
}

export async function upsertAvailabilityRule(companyId, ruleId, data) {
  if (!isFirebaseConfigured() || !companyId) return null;
  const payload = {
    recurrenceType: String(data.recurrenceType || 'weekly'),
    daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [],
    periods: Array.isArray(data.periods) ? data.periods : [],
    effectiveMode: String(data.effectiveMode || 'forever'),
    effectiveFrom: data.effectiveFrom || null,
    effectiveTo: data.effectiveTo || null,
    monthlyPattern: data.monthlyPattern || null,
    serviceId: data.serviceId ? String(data.serviceId) : null,
    employeeId: data.employeeId ? String(data.employeeId) : null,
    active: data.active !== false,
    label: data.label ? String(data.label).slice(0, 80) : '',
    updatedAt: serverTimestamp(),
  };
  const ref = ruleId
    ? doc(getDb(), 'companies', companyId, 'availabilityRules', ruleId)
    : doc(col(companyId, 'availabilityRules'));
  if (!ruleId) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
  return ref.id;
}

export async function deleteAvailabilityRule(companyId, ruleId) {
  if (!isFirebaseConfigured() || !companyId || !ruleId) return;
  await deleteDoc(doc(getDb(), 'companies', companyId, 'availabilityRules', ruleId));
}

export function subscribeAvailabilityOverrides(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext([]);
    return () => {};
  }
  return onSnapshot(
    query(col(companyId, 'availabilityOverrides'), orderBy('date', 'asc')),
    (snap) => onNext(snap.docs.map(mapDoc)),
    (err) => (onError ? onError(err) : undefined)
  );
}

export async function upsertAvailabilityOverride(companyId, overrideId, data) {
  if (!isFirebaseConfigured() || !companyId) return null;
  const payload = {
    date: String(data.date || '').slice(0, 10),
    unavailable: Boolean(data.unavailable),
    periods: data.unavailable ? [] : Array.isArray(data.periods) ? data.periods : [],
    serviceId: data.serviceId ? String(data.serviceId) : null,
    employeeId: data.employeeId ? String(data.employeeId) : null,
    note: data.note ? String(data.note).slice(0, 200) : '',
    updatedAt: serverTimestamp(),
  };
  const ref = overrideId
    ? doc(getDb(), 'companies', companyId, 'availabilityOverrides', overrideId)
    : doc(col(companyId, 'availabilityOverrides'));
  if (!overrideId) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
  return ref.id;
}

export async function deleteAvailabilityOverride(companyId, overrideId) {
  if (!isFirebaseConfigured() || !companyId || !overrideId) return;
  await deleteDoc(doc(getDb(), 'companies', companyId, 'availabilityOverrides', overrideId));
}

export function subscribeVacations(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext([]);
    return () => {};
  }
  return onSnapshot(
    query(col(companyId, 'vacations'), orderBy('startDate', 'asc')),
    (snap) => onNext(snap.docs.map(mapDoc)),
    (err) => (onError ? onError(err) : undefined)
  );
}

export async function upsertVacation(companyId, vacationId, data) {
  if (!isFirebaseConfigured() || !companyId) return null;
  const payload = {
    startDate: String(data.startDate || '').slice(0, 10),
    endDate: String(data.endDate || '').slice(0, 10),
    label: data.label ? String(data.label).slice(0, 120) : 'Time off',
    updatedAt: serverTimestamp(),
  };
  const ref = vacationId
    ? doc(getDb(), 'companies', companyId, 'vacations', vacationId)
    : doc(col(companyId, 'vacations'));
  if (!vacationId) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
  return ref.id;
}

export async function deleteVacation(companyId, vacationId) {
  if (!isFirebaseConfigured() || !companyId || !vacationId) return;
  await deleteDoc(doc(getDb(), 'companies', companyId, 'vacations', vacationId));
}

export function subscribeBlockedPeriods(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext([]);
    return () => {};
  }
  return onSnapshot(
    query(col(companyId, 'blockedPeriods'), orderBy('startAt', 'asc')),
    (snap) => onNext(snap.docs.map(mapDoc)),
    (err) => (onError ? onError(err) : undefined)
  );
}

export async function upsertBlockedPeriod(companyId, blockId, data) {
  if (!isFirebaseConfigured() || !companyId) return null;
  const startAt = data.startAt instanceof Date ? data.startAt : new Date(String(data.startAt));
  const endAt = data.endAt instanceof Date ? data.endAt : new Date(String(data.endAt));
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw new Error('invalid_time_range');
  }
  const payload = {
    startAt: Timestamp.fromDate(startAt),
    endAt: Timestamp.fromDate(endAt),
    label: data.label ? String(data.label).slice(0, 120) : 'Blocked',
    serviceId: data.serviceId ? String(data.serviceId) : null,
    employeeId: data.employeeId ? String(data.employeeId) : null,
    updatedAt: serverTimestamp(),
  };
  const ref = blockId
    ? doc(getDb(), 'companies', companyId, 'blockedPeriods', blockId)
    : doc(col(companyId, 'blockedPeriods'));
  if (!blockId) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
  return ref.id;
}

export async function deleteBlockedPeriod(companyId, blockId) {
  if (!isFirebaseConfigured() || !companyId || !blockId) return;
  await deleteDoc(doc(getDb(), 'companies', companyId, 'blockedPeriods', blockId));
}

export function subscribeEmployees(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext([]);
    return () => {};
  }
  return onSnapshot(
    query(col(companyId, 'employees'), orderBy('name', 'asc')),
    (snap) => onNext(snap.docs.map(mapDoc)),
    (err) => (onError ? onError(err) : undefined)
  );
}

export async function upsertEmployee(companyId, employeeId, data) {
  if (!isFirebaseConfigured() || !companyId) return null;
  const payload = {
    name: String(data.name || '').trim().slice(0, 80),
    active: data.active !== false,
    updatedAt: serverTimestamp(),
  };
  if (!payload.name) throw new Error('employee_name_required');
  const ref = employeeId
    ? doc(getDb(), 'companies', companyId, 'employees', employeeId)
    : doc(col(companyId, 'employees'));
  if (!employeeId) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
  return ref.id;
}

export async function deleteEmployee(companyId, employeeId) {
  if (!isFirebaseConfigured() || !companyId || !employeeId) return;
  await deleteDoc(doc(getDb(), 'companies', companyId, 'employees', employeeId));
}

export async function fetchBookingsInRange(companyId, rangeStart, rangeEnd, { limitCount = 500 } = {}) {
  if (!isFirebaseConfigured() || !companyId) return [];
  const cap = Math.max(50, Math.min(Number(limitCount) || 500, 1000));
  const startTs = Timestamp.fromDate(rangeStart);
  const endTs = Timestamp.fromDate(rangeEnd);
  const q = query(
    collection(getDb(), 'bookings'),
    where('companyId', '==', companyId),
    where('startAt', '>=', startTs),
    where('startAt', '<=', endTs),
    limit(cap)
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map(mapDoc);
  } catch {
    const qFallback = query(
      collection(getDb(), 'bookings'),
      where('companyId', '==', companyId),
      orderBy('startAt', 'desc'),
      limit(cap)
    );
    try {
      const snap = await getDocs(qFallback);
      const startMs = rangeStart.getTime();
      const endMs = rangeEnd.getTime();
      return snap.docs
        .map(mapDoc)
        .filter((b) => {
          const ms = b.startAt?.toDate?.()?.getTime?.() ?? b.startAtMs ?? 0;
          return ms >= startMs && ms <= endMs;
        });
    } catch {
      return [];
    }
  }
}

export async function loadSchedulingContext(companyId) {
  const [settings, rulesSnap, overridesSnap, vacationsSnap, blocksSnap, employeesSnap] = await Promise.all([
    fetchSchedulingSettings(companyId),
    getDocs(query(col(companyId, 'availabilityRules'), orderBy('createdAt', 'asc'))).catch(() => ({ docs: [] })),
    getDocs(query(col(companyId, 'availabilityOverrides'), orderBy('date', 'asc'))).catch(() => ({ docs: [] })),
    getDocs(query(col(companyId, 'vacations'), orderBy('startDate', 'asc'))).catch(() => ({ docs: [] })),
    getDocs(query(col(companyId, 'blockedPeriods'), orderBy('startAt', 'asc'))).catch(() => ({ docs: [] })),
    getDocs(query(col(companyId, 'employees'), orderBy('name', 'asc'))).catch(() => ({ docs: [] })),
  ]);

  return {
    settings,
    rules: rulesSnap.docs.map(mapDoc),
    overrides: overridesSnap.docs.map(mapDoc),
    vacations: vacationsSnap.docs.map(mapDoc),
    blockedPeriods: blocksSnap.docs.map(mapDoc),
    employees: employeesSnap.docs.map(mapDoc),
  };
}

export async function ensureDefaultAvailabilityRules(companyId) {
  if (!isFirebaseConfigured() || !companyId) return;
  const snap = await getDocs(col(companyId, 'availabilityRules'));
  if (!snap.empty) return;
  await upsertAvailabilityRule(companyId, null, defaultWeeklyRule());
  await saveSchedulingSettings(companyId, { useRuleEngine: true });
}

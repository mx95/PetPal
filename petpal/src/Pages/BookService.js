import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { bookSlot, fetchCompanyService, fetchOpenSlots } from '../bookings/bookingFirestore';
import { getProviderBookingStatus } from '../bookings/providerDirectoryFirestore';
import {
  buildVariantSnapshot,
  formatVariantLabel,
  resolveBookingDuration,
  resolveBookingPrice,
  resolveServiceVariants,
  resolveVariantById,
  serviceAsksFurLength,
  serviceAsksPetSize,
} from '../bookings/bookingServiceVariants';
import CalendarAddButtons from '../bookings/CalendarAddButtons';
import {
  getCatalogProvider,
  getCatalogService,
  getCatalogSlots,
  isCatalogClosedDay,
  isCatalogProvider,
  LOCAL_BOOKINGS_KEY,
  nextOpenCatalogDayYmd,
  resolveCatalogProviderId,
  resolveCatalogServiceId,
} from '../bookings/bookingCatalog';
import { BookingSchedulePicker } from '../bookings/components/BookingSchedulePicker';
import {
  buildAddonsSnapshot,
  formatCombinedPrice,
  getCatalogAddons,
  resolveAddonsByIds,
  sumAddonDuration,
} from '../bookings/bookingAddons';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
import { doc, getDoc } from 'firebase/firestore';
import { sendBookingConfirmationEmail } from '../bookings/sendBookingEmail';
import { formatTime24 } from '../formatTime24';
import { categoryEmoji } from '../pets/petCategories';
import { subscribePets } from '../pets/petsFirestore';
import PetAvatar from '../components/PetAvatar';

function saveLocalBooking(row) {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_BOOKINGS_KEY) || '[]');
    const rows = Array.isArray(parsed) ? parsed : [];
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify([row, ...rows].slice(0, 20)));
  } catch {
    /* ignore */
  }
}

function isCatalogSlotId(slotId) {
  return String(slotId || '').startsWith('slot_');
}

function mapBookingError(e, t) {
  const code = String(e?.code || '');
  const msg = String(e?.message || '');
  if (msg === 'slot_not_open') return t('bookConfirm.errorSlotTaken');
  if (msg === 'slot_not_found') return t('bookConfirm.errorSlotMissing');
  if (msg === 'booking_not_enabled') return t('bookConfirm.errorNotEnabled');
  if (msg === 'booking_provider_missing') return t('bookConfirm.errorProviderMissing');
  if (msg === 'booking_self_account') return t('bookConfirm.errorSelfAccount');
  if (msg === 'booking_auth_required') return t('bookConfirm.errorSignIn');
  if (msg === 'booking_auth_mismatch') return t('bookConfirm.errorAuthMismatch');
  if (msg === 'booking_permission_denied') return t('bookConfirm.errorPermissionEnabled');
  if (msg === 'booking_timeout') return t('bookConfirm.errorTimeout');
  if (msg === 'firebase_unconfigured') return t('bookConfirm.errorOffline');
  if (msg === 'missing_fields') return t('bookConfirm.errorIncomplete');
  if (code === 'permission-denied' || /permission/i.test(msg)) return t('bookConfirm.errorPermission');
  return msg && msg !== 'failed' ? msg : t('bookConfirm.errorGeneric');
}

function withTimeout(promise, ms, errorCode = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorCode)), ms);
    }),
  ]);
}

async function resolveBusinessEmail(companyId, catalogProvider) {
  if (catalogProvider?.email) return String(catalogProvider.email).trim();
  if (!isFirebaseConfigured()) return '';
  try {
    const companySnap = await getDoc(doc(getDb(), 'companies', companyId));
    if (companySnap.exists()) {
      const publicEmail = String(companySnap.data()?.publicEmail || '').trim();
      if (publicEmail) return publicEmail;
    }
  } catch {
    /* ignore */
  }
  try {
    const providerSnap = await getDoc(doc(getDb(), 'providers', companyId));
    if (providerSnap.exists()) {
      const bookingEmail = String(providerSnap.data()?.bookingNotificationEmail || '').trim();
      if (bookingEmail) return bookingEmail;
    }
  } catch {
    /* ignore */
  }
  return '';
}

async function notifyBookingByEmail({
  user,
  bookingId,
  companyId,
  catalogProvider,
  providerName,
  providerAddress,
  serviceName,
  resolvedDuration,
  resolvedPrice,
  selectedAddons,
  variantSnapshot,
  slot,
  pet,
  t,
}) {
  const customerEmail = String(user?.email || '').trim();
  if (!customerEmail) return;
  const businessEmail = await resolveBusinessEmail(companyId, catalogProvider);
  const whenIso =
    slot?.startAtIso || slot?.startAt?.toDate?.()?.toISOString?.() || new Date().toISOString();
  void sendBookingConfirmationEmail({
    bookingId,
    companyId,
    customerEmail,
    businessEmail,
    storeName: providerName,
    providerName,
    serviceName,
    petName: pet?.name || 'Pet',
    variantLabel: variantSnapshot?.label || '',
    whenIso,
    durationMin: resolvedDuration,
    price: resolvedPrice || '',
    address: providerAddress || '',
    addons: (selectedAddons || []).map((a) => t(a.nameKey)),
  });
}

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayYmdLocal() {
  return toLocalInputValue(new Date());
}

function maxAfterYmdLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 400);
  return toLocalInputValue(d);
}

function clampAfterDateYmd(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return todayYmdLocal();
  const min = todayYmdLocal();
  const max = maxAfterYmdLocal();
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function calendarMarkParts(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { mon: '—', day: '·' };
  const mon = d
    .toLocaleString(undefined, { month: 'short' })
    .replace(/\./g, '')
    .slice(0, 3)
    .toUpperCase();
  return { mon: mon || '—', day: String(d.getDate()) };
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatWhenLine(date, lang = 'en') {
  if (!date) return '';
  const day = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = formatTime24(date, lang);
  return `${day} · ${time}`;
}

function durationBetween(start, end) {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

function providerInitials(name) {
  const s = String(name || '').trim();
  if (!s) return 'PP';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return s.slice(0, 2).toUpperCase();
}


function WizardProgress({ steps, currentIndex, ariaLabel }) {
  return (
    <ol className="pp-bookWizardProgress" aria-label={ariaLabel}>
      {steps.map((label, i) => (
        <li
          key={`${label}-${i}`}
          className={`pp-bookWizardProgress__item${i <= currentIndex ? ' is-active' : ''}${i < currentIndex ? ' is-done' : ''}`}
        >
          <span className="pp-bookWizardProgress__dot" aria-hidden>
            {i < currentIndex ? '✓' : i + 1}
          </span>
          <span className="pp-bookWizardProgress__label">{label}</span>
        </li>
      ))}
    </ol>
  );
}

export default function BookService({ embedded = false }) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { providerId, serviceId: rawServiceId } = useParams();
  const rawProviderId = String(providerId || '');
  const rawServiceIdStr = String(rawServiceId || '');
  const companyId = resolveCatalogProviderId(rawProviderId);
  const serviceId = resolveCatalogServiceId(rawServiceIdStr);
  const uid = user?.uid || null;
  const needsLegacyRedirect = companyId !== rawProviderId || serviceId !== rawServiceIdStr;

  const useCatalog = isCatalogProvider(companyId);

  const [pets, setPets] = useState([]);
  const [petId, setPetId] = useState('');
  const [service, setService] = useState(null);
  const [variantId, setVariantId] = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [afterDate, setAfterDate] = useState(() => clampAfterDateYmd(toLocalInputValue(new Date())));
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [providerBookingEnabled, setProviderBookingEnabled] = useState(null);
  const [providerBookingCheckBusy, setProviderBookingCheckBusy] = useState(false);
  const refreshSeqRef = useRef(0);
  const autoDayJumpRef = useRef(0);

  const routeState = location.state && typeof location.state === 'object' ? location.state : null;
  const catalogProvider = useCatalog ? getCatalogProvider(companyId) : null;

  const petOptions = pets;

  const coatVariants = useMemo(() => resolveServiceVariants(service), [service]);
  const showCoatStep = coatVariants.length > 0;
  const asksPetSize = serviceAsksPetSize(service);
  const asksFurLength = serviceAsksFurLength(service);
  const addonOptions = useMemo(() => getCatalogAddons(companyId), [companyId]);
  const showServicesStep = addonOptions.length > 0;
  const selectedAddons = useMemo(
    () => resolveAddonsByIds(companyId, selectedAddonIds),
    [companyId, selectedAddonIds]
  );

  const stepKeys = useMemo(() => {
    const keys = ['pet'];
    if (showServicesStep) keys.push('services');
    if (showCoatStep) keys.push('coat');
    keys.push('schedule', 'review');
    return keys;
  }, [showServicesStep, showCoatStep]);

  const maxStepIndex = Math.max(0, stepKeys.length - 1);

  useEffect(() => {
    setStepIndex((i) => Math.min(i, maxStepIndex));
  }, [maxStepIndex]);

  const wizardSteps = useMemo(
    () =>
      stepKeys.map((key) => {
        if (key === 'pet') return t('bookConfirm.stepPet');
        if (key === 'services') return t('bookConfirm.stepServices');
        if (key === 'coat') {
          if (asksPetSize && asksFurLength) return t('bookConfirm.stepSizeFur');
          if (asksPetSize) return t('bookConfirm.stepSize');
          return t('bookConfirm.stepCoat');
        }
        if (key === 'schedule') return t('bookConfirm.stepSchedule');
        return t('bookConfirm.stepReview');
      }),
    [stepKeys, t, asksPetSize, asksFurLength]
  );

  const stepKey = stepKeys[stepIndex] ?? stepKeys[0] ?? 'pet';

  const baseDuration = useMemo(
    () => resolveBookingDuration(service, variantId),
    [service, variantId]
  );
  const addonDuration = useMemo(() => sumAddonDuration(selectedAddons), [selectedAddons]);
  const resolvedDuration = baseDuration + addonDuration;
  const resolvedPrice = useMemo(() => {
    const variantPrice = resolveBookingPrice(service, variantId);
    const parts = [variantPrice || service?.price, ...selectedAddons.map((a) => a.price)].filter(Boolean);
    return formatCombinedPrice(...parts);
  }, [service, variantId, selectedAddons]);

  useEffect(() => subscribePets(uid, setPets), [uid]);

  useEffect(() => {
    if (useCatalog || !companyId || !isFirebaseConfigured()) {
      setProviderBookingEnabled(useCatalog ? true : null);
      return undefined;
    }
    let cancelled = false;
    setProviderBookingCheckBusy(true);
    void getProviderBookingStatus(companyId)
      .then((status) => {
        if (!cancelled) setProviderBookingEnabled(status.bookingEnabled);
      })
      .catch(() => {
        if (!cancelled) setProviderBookingEnabled(null);
      })
      .finally(() => {
        if (!cancelled) setProviderBookingCheckBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, useCatalog, stepKey]);

  useEffect(() => {
    if (!companyId || useCatalog || providerBookingEnabled !== false) return;
    if (stepKey === 'review') {
      setErr(t('bookConfirm.errorNotEnabled'));
    }
  }, [companyId, useCatalog, providerBookingEnabled, stepKey, t]);

  useEffect(() => {
    if (!companyId || !serviceId) return;
    let cancelled = false;
    void (async () => {
      let row = null;
      if (isFirebaseConfigured()) {
        row = await fetchCompanyService(companyId, serviceId).catch(() => null);
      }
      if (!row && useCatalog) {
        row = getCatalogService(companyId, serviceId);
      }
      if (!cancelled) setService(row);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, serviceId, useCatalog]);

  useEffect(() => {
    const variants = resolveServiceVariants(service);
    if (!variants.length) {
      setVariantId('');
      return;
    }
    setVariantId((prev) => (variants.some((v) => v.id === prev) ? prev : variants[1]?.id || variants[0].id));
  }, [service]);

  useEffect(() => {
    const st = location.state && typeof location.state === 'object' ? location.state : null;
    if (!st) return;
    const demoSlot = st?.prefillSlot || st?.demoBooking?.slot;
    if (demoSlot?.startAtIso) {
      const d = new Date(String(demoSlot.startAtIso));
      if (!Number.isNaN(d.getTime())) {
        setAfterDate(clampAfterDateYmd(toLocalInputValue(d)));
        return;
      }
    }
    const ad = st?.afterDate;
    if (typeof ad === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ad)) {
      setAfterDate(clampAfterDateYmd(ad.slice(0, 10)));
    }
  }, [location.state]);

  useEffect(() => {
    if (!petId && petOptions.length) setPetId(petOptions[0].id);
  }, [petOptions, petId]);

  const after = useMemo(() => {
    const safeYmd = clampAfterDateYmd(afterDate);
    const d = new Date(`${safeYmd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [afterDate]);

  useEffect(() => {
    const c = clampAfterDateYmd(afterDate);
    if (c !== afterDate) setAfterDate(c);
  }, [afterDate]);

  useEffect(() => {
    if (!useCatalog || !companyId) return;
    const today = new Date();
    if (isCatalogClosedDay(companyId, today)) {
      const openYmd = nextOpenCatalogDayYmd(companyId, today);
      setAfterDate(openYmd);
      setMonthDate(new Date(`${openYmd}T12:00:00`));
    }
  }, [useCatalog, companyId]);

  useEffect(() => {
    const safe = clampAfterDateYmd(afterDate);
    setMonthDate(new Date(`${safe}T12:00:00`));
  }, [afterDate]);

  const isClosedDay = useMemo(
    () => (date) => (useCatalog ? isCatalogClosedDay(companyId, date) : false),
    [useCatalog, companyId]
  );

  const refresh = async ({ preserveError = false } = {}) => {
    const seq = ++refreshSeqRef.current;
    if (!preserveError) setErr('');
    setLoadingSlots(true);
    try {
      let rows = [];
      if (useCatalog) {
        rows = getCatalogSlots(companyId, String(serviceId || ''), { after, durationMin: resolvedDuration });
      } else if (isFirebaseConfigured()) {
        rows = await fetchOpenSlots(companyId, String(serviceId || ''), {
          after,
          durationMin: resolvedDuration,
          rangeDays: 21,
          timeoutMs: 15000,
        });
      }
      if (seq !== refreshSeqRef.current) return;

      const dayYmd = clampAfterDateYmd(afterDate);
      const sameDayRows = rows.filter((slot) => {
        const start = asDate(slot.startAt) || asDate(slot.startAtIso);
        return start ? toLocalInputValue(start) === dayYmd : false;
      });
      if (!sameDayRows.length && rows.length && !useCatalog && autoDayJumpRef.current < 6) {
        const first = rows.find((slot) => asDate(slot.startAt) || asDate(slot.startAtIso));
        const start = first ? asDate(first.startAt) || asDate(first.startAtIso) : null;
        if (start) {
          const nextYmd = toLocalInputValue(start);
          if (nextYmd !== dayYmd) {
            autoDayJumpRef.current += 1;
            setAfterDate(nextYmd);
            return;
          }
        }
      }
      autoDayJumpRef.current = 0;
      setSlots(sameDayRows);
      setSlotId((prev) => {
        if (sameDayRows.some((r) => r.id === prev)) return prev;
        return sameDayRows.length ? sameDayRows[0].id : '';
      });
    } catch (e) {
      if (seq !== refreshSeqRef.current) return;
      const msg = String(e?.message || '');
      if (msg === 'slots_timeout') {
        setErr(t('bookingsHub.slotsTimeout'));
      } else if (/permission/i.test(msg)) {
        setErr('Could not load available times. Ask the business to save their listing under Availability → Public listing.');
      } else {
        setErr(msg || 'failed');
      }
    } finally {
      if (seq === refreshSeqRef.current) setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (!companyId || !serviceId) return;
    if (stepKey !== 'schedule' && stepKey !== 'review') return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, serviceId, afterDate, resolvedDuration, stepKey]);

  useEffect(() => {
    const st = location.state && typeof location.state === 'object' ? location.state : null;
    const sid = st?.slotId;
    if (typeof sid !== 'string' || !sid || !slots.some((s) => s.id === sid)) return;
    const slot = slots.find((s) => s.id === sid);
    if (!slot) return;
    setSlotId(sid);
    const start = asDate(slot.startAt) || asDate(slot.startAtIso);
    if (!start) return;
    const slotDay = toLocalInputValue(start);
    setAfterDate((prev) => {
      const prevMs = new Date(`${clampAfterDateYmd(prev)}T00:00:00`).getTime();
      const slotMs = new Date(`${slotDay}T00:00:00`).getTime();
      if (!Number.isFinite(prevMs) || !Number.isFinite(slotMs)) return clampAfterDateYmd(slotDay);
      if (prevMs > slotMs) return clampAfterDateYmd(slotDay);
      return clampAfterDateYmd(prev);
    });
  }, [location.state, slots]);

  if (!user) return <Navigate to="/login" replace />;

  if (needsLegacyRedirect) {
    return (
      <Navigate
        to={`/bookings/provider/${encodeURIComponent(companyId)}/book/${encodeURIComponent(serviceId)}`}
        replace
        state={location.state}
      />
    );
  }

  const selectedPet = petOptions.find((p) => p.id === petId) || null;
  const selectedVariant = resolveVariantById(service, variantId);
  const providerName =
    routeState?.providerName || catalogProvider?.displayName || t('bookConfirm.providerFallback');
  const providerAddress = routeState?.providerAddress || catalogProvider?.address || '';
  const serviceName = service?.name || routeState?.serviceName || t('bookConfirm.serviceFallback');

  function toggleAddon(addonId) {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  }

  function canProceed() {
    if (stepKey === 'pet') return Boolean(petId);
    if (stepKey === 'services') return selectedAddonIds.length > 0;
    if (stepKey === 'coat') return Boolean(variantId);
    if (stepKey === 'schedule') return Boolean(slotId);
    return true;
  }

  function goNext() {
    if (!canProceed()) return;
    setStepIndex((i) => Math.min(i + 1, wizardSteps.length - 1));
  }

  function goBack() {
    if (stepIndex <= 0) {
      if (window.history.length > 1) navigate(-1);
      else navigate('/bookings');
      return;
    }
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  const onBook = async () => {
    setErr('');
    if (!uid) {
      setErr(t('bookConfirm.errorSignIn'));
      return;
    }
    if (!slotId) {
      setErr(t('bookConfirm.errorPickSlot'));
      return;
    }
    if (!useCatalog && isFirebaseConfigured()) {
      try {
        const status = await getProviderBookingStatus(companyId);
        if (!status.exists) {
          setErr(t('bookConfirm.errorProviderMissing'));
          return;
        }
        if (!status.bookingEnabled) {
          setErr(t('bookConfirm.errorNotEnabled'));
          return;
        }
      } catch {
        setErr(t('bookConfirm.errorPermission'));
        return;
      }
    }
    setBusy(true);
    try {
      if (user?.getIdToken) {
        await user.getIdToken(true).catch(() => {});
      }
      const pet = selectedPet;
      const slot = slots.find((s) => s.id === slotId) || null;
      const variantSnapshot = buildVariantSnapshot(service, variantId, t);
      const addonsSnapshot = buildAddonsSnapshot(selectedAddons, t);
      const serviceSnapshot = service
        ? {
            name: service.name,
            type: service.type || null,
            durationMin: resolvedDuration,
            price: resolvedPrice || null,
            addons: addonsSnapshot,
          }
        : null;

      const useLocalBooking = !isFirebaseConfigured() || isCatalogSlotId(slotId);

      if (useLocalBooking) {
        const bookingId = `local_${Date.now()}`;
        const row = {
          id: bookingId,
          bookingId,
          companyId,
          serviceId,
          slotId,
          customerUid: uid,
          petId,
          petName: pet?.name || '',
          petSnapshot: { name: pet?.name || '', categoryId: pet?.categoryId || 'dog' },
          variantId: variantId || null,
          variantSnapshot,
          addonsSnapshot,
          serviceSnapshot,
          providerName,
          providerAddress,
          serviceName,
          startAtIso: slot?.startAtIso || slot?.startAt?.toDate?.()?.toISOString?.(),
          endAtIso: slot?.endAtIso || slot?.endAt?.toDate?.()?.toISOString?.(),
          startAt: slot?.startAt || null,
          endAt: slot?.endAt || null,
          durationMin: resolvedDuration,
          price: resolvedPrice || null,
          status: 'confirmed',
          createdAtIso: new Date().toISOString(),
        };
        saveLocalBooking(row);
        setConfirmedBooking(row);
        void notifyBookingByEmail({
          user,
          bookingId,
          companyId,
          catalogProvider,
          providerName,
          providerAddress,
          serviceName,
          resolvedDuration,
          resolvedPrice,
          selectedAddons,
          variantSnapshot,
          slot,
          pet,
          t,
        });
        setBusy(false);
        return;
      }

      const bookingId = await withTimeout(
        bookSlot({
          companyId,
          serviceId,
          slotId,
          customerUid: uid,
          petId,
          petSnapshot: { name: pet?.name || '', categoryId: pet?.categoryId || 'dog' },
          variantId: variantId || null,
          variantSnapshot,
          addonsSnapshot,
          serviceSnapshot,
          durationMin: resolvedDuration,
          forCustomer: true,
          price: resolvedPrice || null,
          addons: selectedAddons.map((a) => t(a.nameKey)),
          providerName,
          providerAddress,
        }),
        45000,
        'booking_timeout'
      );
      setConfirmedBooking({
        id: bookingId,
        bookingId,
        companyId,
        serviceId,
        slotId,
        petId,
        petName: pet?.name || 'Pet',
        petSnapshot: { name: pet?.name || 'Pet', categoryId: pet?.categoryId || 'dog' },
        variantId: variantId || null,
        variantSnapshot,
        addonsSnapshot,
        serviceSnapshot,
        providerName,
        providerAddress,
        serviceName,
        durationMin: resolvedDuration,
        price: resolvedPrice || null,
        startAt: slot?.startAt || null,
        endAt: slot?.endAt || null,
        startAtIso: slot?.startAtIso || slot?.startAt?.toDate?.()?.toISOString?.(),
        endAtIso: slot?.endAtIso || slot?.endAt?.toDate?.()?.toISOString?.(),
        status: 'booked',
      });
      setBusy(false);
    } catch (e) {
      setBusy(false);
      const bookingErr = mapBookingError(e, t);
      const code = String(e?.message || '');
      if (code === 'slot_not_open' || code === 'slot_not_found') {
        await refresh({ preserveError: true });
      }
      setErr(bookingErr);
    }
  };

  const markParts = confirmedBooking ? null : calendarMarkParts(clampAfterDateYmd(afterDate));
  const bookingStart = confirmedBooking ? asDate(confirmedBooking.startAt || confirmedBooking.startAtIso) : null;
  const bookingEnd = confirmedBooking ? asDate(confirmedBooking.endAt || confirmedBooking.endAtIso) : null;
  const bookingDuration =
    confirmedBooking &&
    (typeof confirmedBooking.durationMin === 'number'
      ? confirmedBooking.durationMin
      : durationBetween(bookingStart, bookingEnd));

  const confirmBlocked =
    busy ||
    !petOptions.length ||
    !slotId ||
    providerBookingCheckBusy ||
    (!useCatalog && providerBookingEnabled === false);

  return (
    <div className={`pp-bookConfirmPage${embedded ? ' pp-bookConfirmPage--embedded' : ''}`}>
      <header className="pp-bookConfirmPage__header">
        <div className="pp-bookConfirmPage__mark" aria-hidden>
          {confirmedBooking ? (
            <span className="pp-bookConfirmPage__markTick">✓</span>
          ) : (
            <span className="pp-bookConfirmPage__markCal">
              <span className="pp-bookConfirmPage__markCalMon">{markParts.mon}</span>
              <span className="pp-bookConfirmPage__markCalDay">{markParts.day}</span>
            </span>
          )}
        </div>
        <p className="pp-bookConfirmPage__eyebrow">
          {confirmedBooking ? t('bookConfirm.successEyebrow') : t('bookConfirm.eyebrow')}
        </p>
        <h1 className="pp-bookConfirmPage__title">
          {confirmedBooking ? t('bookConfirm.successTitle') : t('bookConfirm.title')}
        </h1>
        {confirmedBooking ? (
          <p className="pp-bookConfirmPage__lead">{t('bookConfirm.successLead')}</p>
        ) : null}
        {!confirmedBooking ? (
          <p className="pp-bookConfirmPage__serviceLine">
            <strong>{serviceName}</strong>
            {providerName ? <span> · {providerName}</span> : null}
          </p>
        ) : null}
      </header>

      {err ? <div className="pp-bookConfirmPage__alert">{err}</div> : null}

      {confirmedBooking ? (
        <>
          <section className="pp-bookConfirmPass" aria-label={t('bookConfirm.passAria')}>
            <div className="pp-bookConfirmPass__top">
              <div className="pp-bookConfirmPass__avatar" aria-hidden>
                {providerInitials(confirmedBooking.providerName)}
              </div>
              <div className="pp-bookConfirmPass__topText">
                <span className="pp-bookConfirmPass__provider">{confirmedBooking.providerName}</span>
                <span className="pp-bookConfirmPass__service">{confirmedBooking.serviceName}</span>
              </div>
              <span className="pp-bookConfirmPass__badge">{t('bookConfirm.instantBadge')}</span>
            </div>
            <div className="pp-bookConfirmPass__divider" />
            <dl className="pp-bookConfirmPass__rows">
              <div className="pp-bookConfirmPass__row">
                <dt>{t('bookConfirm.petLabel')}</dt>
                <dd>{confirmedBooking.petName || confirmedBooking.petSnapshot?.name || '—'}</dd>
              </div>
              {confirmedBooking.variantSnapshot?.label ? (
                <div className="pp-bookConfirmPass__row">
                  <dt>{t('bookConfirm.variantLabel')}</dt>
                  <dd>{confirmedBooking.variantSnapshot.label}</dd>
                </div>
              ) : null}
              {confirmedBooking.addonsSnapshot?.length || confirmedBooking.serviceSnapshot?.addons?.length ? (
                <div className="pp-bookConfirmPass__row">
                  <dt>{t('bookConfirm.addonsLabel')}</dt>
                  <dd>
                    {(confirmedBooking.addonsSnapshot || confirmedBooking.serviceSnapshot?.addons || [])
                      .map((a) => a.name)
                      .join(', ')}
                  </dd>
                </div>
              ) : null}
              <div className="pp-bookConfirmPass__row">
                <dt>{t('bookConfirm.whenLabel')}</dt>
                <dd>{bookingStart ? formatWhenLine(bookingStart, language) : '—'}</dd>
              </div>
              {bookingDuration != null ? (
                <div className="pp-bookConfirmPass__row">
                  <dt>{t('bookConfirm.durationLabel')}</dt>
                  <dd>{t('bookConfirm.mins', { n: bookingDuration })}</dd>
                </div>
              ) : null}
              {confirmedBooking.price || confirmedBooking.variantSnapshot?.price ? (
                <div className="pp-bookConfirmPass__row">
                  <dt>{t('bookConfirm.priceLabel')}</dt>
                  <dd>{confirmedBooking.price || confirmedBooking.variantSnapshot?.price}</dd>
                </div>
              ) : null}
              {confirmedBooking.providerAddress ? (
                <div className="pp-bookConfirmPass__row">
                  <dt>{t('bookConfirm.addressLabel')}</dt>
                  <dd>{confirmedBooking.providerAddress}</dd>
                </div>
              ) : null}
              <div className="pp-bookConfirmPass__row pp-bookConfirmPass__row--ref">
                <dt>{t('bookConfirm.refLabel')}</dt>
                <dd>
                  <code className="pp-bookConfirmPass__code">
                    {String(confirmedBooking.bookingId || confirmedBooking.id)}
                  </code>
                </dd>
              </div>
            </dl>
          </section>

          <CalendarAddButtons
            booking={confirmedBooking}
            googleLabel={t('bookConfirm.calGoogleShort')}
            appleLabel={t('bookConfirm.calAppleShort')}
            googleAria={t('bookConfirm.calGoogleAria')}
            appleAria={t('bookConfirm.calAppleAria')}
            groupAria={t('bookConfirm.calGroupAria')}
          />

          <ul className="pp-bookConfirmTrust">
            <li>{t('bookConfirm.trustFreeCancel')}</li>
            <li>{t('bookConfirm.trustSecure')}</li>
            <li>{t('bookConfirm.trustEmail')}</li>
            <li>{t('bookConfirm.trustReminder')}</li>
          </ul>

          <button
            type="button"
            className="pp-bookConfirmPage__textCta"
            onClick={() => navigate('/bookings', { replace: true })}
          >
            {t('bookConfirm.backBookings')}
          </button>
        </>
      ) : (
        <>
          <WizardProgress steps={wizardSteps} currentIndex={stepIndex} ariaLabel={t('bookConfirm.bookingStepsAria')} />

          <section className="pp-bookWizardPanel">
            {stepKey === 'pet' ? (
              <>
                <h2 className="pp-bookWizardPanel__title">{t('bookConfirm.petStepTitle')}</h2>
                <p className="pp-bookWizardPanel__lead">{t('bookConfirm.petStepLead')}</p>
                {petOptions.length ? (
                  <ul className="pp-bookPetPick">
                    {petOptions.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={`pp-bookPetPick__card${petId === p.id ? ' is-active' : ''}`}
                          onClick={() => setPetId(p.id)}
                        >
                          <PetAvatar pet={p} size={48} />
                          <span className="pp-bookPetPick__name">{p.name}</span>
                          <span className="pp-bookPetPick__meta">{categoryEmoji(p.categoryId)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="pp-bookConfirmField__empty">
                    <p>{t('bookConfirm.noPetsLead')}</p>
                    <Link className="pp-bookConfirmPage__link" to="/pets#add-pet">
                      {t('bookConfirm.noPetsCta')}
                    </Link>
                  </div>
                )}
              </>
            ) : null}

            {stepKey === 'services' ? (
              <>
                <h2 className="pp-bookWizardPanel__title">{t('bookConfirm.servicesStepTitle')}</h2>
                <p className="pp-bookWizardPanel__lead">{t('bookConfirm.servicesStepLead')}</p>
                <ul className="pp-bookAddonPick">
                  {addonOptions.map((addon) => {
                    const active = selectedAddonIds.includes(addon.id);
                    return (
                      <li key={addon.id}>
                        <button
                          type="button"
                          className={`pp-bookAddonPick__card${active ? ' is-active' : ''}`}
                          aria-pressed={active}
                          onClick={() => toggleAddon(addon.id)}
                        >
                          <span className="pp-bookAddonPick__emoji" aria-hidden>
                            {addon.emoji || '✓'}
                          </span>
                          <span className="pp-bookAddonPick__body">
                            <span className="pp-bookAddonPick__name">{t(addon.nameKey)}</span>
                            <span className="pp-bookAddonPick__meta">
                              {t('bookConfirm.mins', { n: addon.durationMin })}
                              {addon.price ? ` · ${addon.price}` : ''}
                            </span>
                          </span>
                          <span className="pp-bookAddonPick__check" aria-hidden>
                            {active ? '✓' : ''}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}

            {stepKey === 'coat' ? (
              <>
                <h2 className="pp-bookWizardPanel__title">
                  {asksPetSize && asksFurLength
                    ? t('bookConfirm.sizeFurStepTitle')
                    : asksPetSize
                      ? t('bookConfirm.sizeStepTitle')
                      : t('bookConfirm.coatStepTitle')}
                </h2>
                <p className="pp-bookWizardPanel__lead">
                  {asksPetSize && asksFurLength
                    ? t('bookConfirm.sizeFurStepLead')
                    : asksPetSize
                      ? t('bookConfirm.sizeStepLead')
                      : t('bookConfirm.coatStepLead')}
                </p>
                <ul className="pp-bookVariantPick">
                  {coatVariants.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        className={`pp-bookVariantPick__card${variantId === v.id ? ' is-active' : ''}`}
                        onClick={() => setVariantId(v.id)}
                      >
                        <span className="pp-bookVariantPick__name">{formatVariantLabel(v, t)}</span>
                        {v.descriptionKey && !(v.sizeId && v.furId) ? (
                          <span className="pp-bookVariantPick__desc">{t(v.descriptionKey)}</span>
                        ) : null}
                        <span className="pp-bookVariantPick__meta">
                          {t('bookConfirm.mins', { n: v.durationMin })}
                          {v.price ? ` · ${v.price}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {stepKey === 'schedule' ? (
              <>
                <h2 className="pp-bookWizardPanel__title">{t('bookConfirm.scheduleStepTitle')}</h2>
                <p className="pp-bookWizardPanel__lead">
                  {selectedPet
                    ? t('bookConfirm.scheduleStepLead', { pet: selectedPet.name })
                    : t('bookConfirm.scheduleStepLeadGeneric')}
                </p>
                {selectedVariant || selectedAddons.length ? (
                  <p className="pp-bookWizardPanel__hint">
                    {selectedVariant ? formatVariantLabel(selectedVariant, t) : null}
                    {selectedVariant && selectedAddons.length ? ' · ' : null}
                    {selectedAddons.length
                      ? selectedAddons.map((a) => t(a.nameKey)).join(', ')
                      : null}
                    {' · '}
                    {t('bookConfirm.scheduleDurationHintMins', { mins: resolvedDuration })}
                  </p>
                ) : null}
                <BookingSchedulePicker
                  dayKey={clampAfterDateYmd(afterDate)}
                  onDayKeyChange={(ymd) => {
                    autoDayJumpRef.current = 0;
                    setAfterDate(clampAfterDateYmd(ymd));
                  }}
                  monthDate={monthDate}
                  onMonthDateChange={setMonthDate}
                  slots={slots}
                  slotId={slotId}
                  onSlotIdChange={setSlotId}
                  durationMin={resolvedDuration}
                  loading={loadingSlots}
                  error={err}
                  isClosedDay={isClosedDay}
                />
              </>
            ) : null}

            {stepKey === 'review' ? (
              <>
                <h2 className="pp-bookWizardPanel__title">{t('bookConfirm.reviewStepTitle')}</h2>
                {!useCatalog && uid === companyId ? (
                  <p className="pp-book-muted" role="status">
                    {t('bookConfirm.selfAccountHint')}
                  </p>
                ) : null}
                {!useCatalog && providerBookingEnabled === false ? (
                  <p className="pp-bookConfirmPage__alert" role="status">
                    {t('bookConfirm.errorNotEnabled')}
                  </p>
                ) : null}
                {!useCatalog && providerBookingCheckBusy ? (
                  <p className="pp-book-muted">{t('bookConfirm.checkingAvailability')}</p>
                ) : null}
                <dl className="pp-bookReviewRows">
                  <div className="pp-bookReviewRows__row">
                    <dt>{t('bookConfirm.petLabel')}</dt>
                    <dd>{selectedPet?.name || '—'}</dd>
                  </div>
                  <div className="pp-bookReviewRows__row">
                    <dt>{t('bookConfirm.serviceLabel')}</dt>
                    <dd>{serviceName}</dd>
                  </div>
                  {selectedAddons.length ? (
                    <div className="pp-bookReviewRows__row">
                      <dt>{t('bookConfirm.addonsLabel')}</dt>
                      <dd>{selectedAddons.map((a) => t(a.nameKey)).join(', ')}</dd>
                    </div>
                  ) : null}
                  {selectedVariant ? (
                    <div className="pp-bookReviewRows__row">
                      <dt>{t('bookConfirm.variantLabel')}</dt>
                      <dd>{formatVariantLabel(selectedVariant, t)}</dd>
                    </div>
                  ) : null}
                  <div className="pp-bookReviewRows__row">
                    <dt>{t('bookConfirm.whenLabel')}</dt>
                    <dd>
                      {(() => {
                        const slot = slots.find((s) => s.id === slotId);
                        const start = slot ? asDate(slot.startAt) || asDate(slot.startAtIso) : null;
                        return start ? formatWhenLine(start, language) : '—';
                      })()}
                    </dd>
                  </div>
                  <div className="pp-bookReviewRows__row">
                    <dt>{t('bookConfirm.durationLabel')}</dt>
                    <dd>{t('bookConfirm.mins', { n: resolvedDuration })}</dd>
                  </div>
                  {resolvedPrice ? (
                    <div className="pp-bookReviewRows__row">
                      <dt>{t('bookConfirm.priceLabel')}</dt>
                      <dd>{resolvedPrice}</dd>
                    </div>
                  ) : null}
                  {providerAddress ? (
                    <div className="pp-bookReviewRows__row">
                      <dt>{t('bookConfirm.addressLabel')}</dt>
                      <dd>{providerAddress}</dd>
                    </div>
                  ) : null}
                </dl>
              </>
            ) : null}
          </section>

          <div className="pp-bookWizardNav">
            <button
              type="button"
              className="pp-bookConfirmForm__ghost"
              disabled={busy}
              onClick={goBack}
            >
              {t('bookConfirm.wizardBack')}
            </button>
            {stepKey === 'review' ? (
              <button
                type="button"
                className="pp-bookConfirmForm__primary"
                disabled={confirmBlocked}
                onClick={() => void onBook()}
              >
                {busy ? t('bookConfirm.submitting') : t('bookConfirm.ctaConfirm')}
              </button>
            ) : (
              <button
                type="button"
                className="pp-bookConfirmForm__primary"
                disabled={!canProceed()}
                onClick={goNext}
              >
                {t('bookConfirm.wizardNext')}
              </button>
            )}
          </div>

          {!embedded ? (
            <button
              type="button"
              className="pp-bookConfirmPage__textCta"
              disabled={busy}
              onClick={() => navigate(-1)}
            >
              {t('bookConfirm.cancel')}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { bookSlot, fetchCompanyService, fetchOpenSlots } from '../bookings/bookingFirestore';
import {
  buildVariantSnapshot,
  isCoatVariantService,
  resolveBookingDuration,
  resolveBookingPrice,
  resolveServiceVariants,
  resolveVariantById,
} from '../bookings/bookingServiceVariants';
import { appleCalendarDataUrl, buildCalendarEvent, googleCalendarUrl } from '../bookings/calendarLinks';
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
import { isFirebaseConfigured } from '../firebase';
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


function GoogleCalIcon() {
  return (
    <svg className="pp-bookConfirmCalBtn__svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"
      />
    </svg>
  );
}

function AppleCalIcon() {
  return (
    <svg className="pp-bookConfirmCalBtn__svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
      />
    </svg>
  );
}

function WizardProgress({ steps, currentIndex }) {
  return (
    <ol className="pp-bookWizardProgress" aria-label="Booking steps">
      {steps.map((label, i) => (
        <li
          key={label}
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
  const [stepIndex, setStepIndex] = useState(0);
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [afterDate, setAfterDate] = useState(() => clampAfterDateYmd(toLocalInputValue(new Date())));
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const routeState = location.state && typeof location.state === 'object' ? location.state : null;
  const catalogProvider = useCatalog ? getCatalogProvider(companyId) : null;

  const petOptions = pets;

  const coatVariants = useMemo(() => resolveServiceVariants(service), [service]);
  const showCoatStep = coatVariants.length > 0 && isCoatVariantService(service);
  const wizardSteps = useMemo(
    () =>
      showCoatStep
        ? [
            t('bookConfirm.stepPet'),
            t('bookConfirm.stepCoat'),
            t('bookConfirm.stepSchedule'),
            t('bookConfirm.stepReview'),
          ]
        : [t('bookConfirm.stepPet'), t('bookConfirm.stepSchedule'), t('bookConfirm.stepReview')],
    [showCoatStep, t]
  );

  const stepKey = showCoatStep
    ? (['pet', 'coat', 'schedule', 'review'][stepIndex] || 'pet')
    : (['pet', 'schedule', 'review'][stepIndex] || 'pet');

  const resolvedDuration = useMemo(
    () => resolveBookingDuration(service, variantId),
    [service, variantId]
  );
  const resolvedPrice = useMemo(
    () => resolveBookingPrice(service, variantId),
    [service, variantId]
  );

  useEffect(() => subscribePets(uid, setPets), [uid]);

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

  const refresh = async () => {
    setErr('');
    setLoadingSlots(true);
    try {
      let rows = [];
      if (isFirebaseConfigured()) {
        rows = await fetchOpenSlots(companyId, String(serviceId || ''), { after }).catch(() => []);
      }
      if (!rows.length && useCatalog) {
        rows = getCatalogSlots(companyId, String(serviceId || ''), { after, durationMin: resolvedDuration });
      }
      const dayYmd = clampAfterDateYmd(afterDate);
      const sameDayRows = rows.filter((slot) => {
        const start = asDate(slot.startAt) || asDate(slot.startAtIso);
        return start ? toLocalInputValue(start) === dayYmd : true;
      });
      setSlots(sameDayRows);
      setSlotId((prev) => {
        if (sameDayRows.some((r) => r.id === prev)) return prev;
        return sameDayRows.length ? sameDayRows[0].id : '';
      });
    } catch (e) {
      setErr(e?.message || 'failed');
    } finally {
      setLoadingSlots(false);
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

  function canProceed() {
    if (stepKey === 'pet') return Boolean(petId);
    if (stepKey === 'coat') return Boolean(variantId);
    if (stepKey === 'schedule') return Boolean(slotId);
    return true;
  }

  function goNext() {
    if (!canProceed()) return;
    setStepIndex((i) => Math.min(i + 1, wizardSteps.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  const onBook = async () => {
    setErr('');
    setBusy(true);
    try {
      const pet = selectedPet;
      const slot = slots.find((s) => s.id === slotId) || null;
      const variantSnapshot = buildVariantSnapshot(service, variantId, t);
      const serviceSnapshot = service
        ? {
            name: service.name,
            type: service.type || null,
            durationMin: resolvedDuration,
            price: resolvedPrice || null,
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
        setBusy(false);
        return;
      }

      const bookingId = await bookSlot({
        companyId,
        serviceId,
        slotId,
        customerUid: uid,
        petId,
        petSnapshot: { name: pet?.name || '', categoryId: pet?.categoryId || 'dog' },
        variantId: variantId || null,
        variantSnapshot,
        serviceSnapshot,
      });
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
      setErr(e?.message || 'failed');
      setBusy(false);
      refresh();
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
  const calEvent = confirmedBooking ? buildCalendarEvent(confirmedBooking) : null;

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
        <p className="pp-bookConfirmPage__lead">
          {confirmedBooking ? t('bookConfirm.successLead') : t('bookConfirm.subtitle')}
        </p>
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

          {calEvent ? (
            <div className="pp-bookConfirmCalRow" role="group" aria-label={t('bookConfirm.calGroupAria')}>
              <a
                className="pp-bookConfirmCalBtn"
                href={googleCalendarUrl(calEvent)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('bookConfirm.calGoogleAria')}
              >
                <GoogleCalIcon />
                <span>{t('bookConfirm.calGoogleShort')}</span>
              </a>
              <a
                className="pp-bookConfirmCalBtn"
                href={appleCalendarDataUrl(calEvent)}
                download="petpal-booking.ics"
                aria-label={t('bookConfirm.calAppleAria')}
              >
                <AppleCalIcon />
                <span>{t('bookConfirm.calAppleShort')}</span>
              </a>
            </div>
          ) : null}

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
          <WizardProgress steps={wizardSteps} currentIndex={stepIndex} />

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

            {stepKey === 'coat' ? (
              <>
                <h2 className="pp-bookWizardPanel__title">{t('bookConfirm.coatStepTitle')}</h2>
                <p className="pp-bookWizardPanel__lead">{t('bookConfirm.coatStepLead')}</p>
                <ul className="pp-bookVariantPick">
                  {coatVariants.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        className={`pp-bookVariantPick__card${variantId === v.id ? ' is-active' : ''}`}
                        onClick={() => setVariantId(v.id)}
                      >
                        <span className="pp-bookVariantPick__name">{t(v.labelKey)}</span>
                        {v.descriptionKey ? (
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
                {selectedVariant ? (
                  <p className="pp-bookWizardPanel__hint">
                    {t('bookConfirm.scheduleDurationHint', {
                      variant: t(selectedVariant.labelKey),
                      mins: resolvedDuration,
                    })}
                  </p>
                ) : null}
                <BookingSchedulePicker
                  dayKey={clampAfterDateYmd(afterDate)}
                  onDayKeyChange={(ymd) => setAfterDate(clampAfterDateYmd(ymd))}
                  monthDate={monthDate}
                  onMonthDateChange={setMonthDate}
                  slots={slots}
                  slotId={slotId}
                  onSlotIdChange={setSlotId}
                  durationMin={resolvedDuration}
                  loading={loadingSlots}
                  error={err}
                  isClosedDay={isClosedDay}
                  t={t}
                />
              </>
            ) : null}

            {stepKey === 'review' ? (
              <>
                <h2 className="pp-bookWizardPanel__title">{t('bookConfirm.reviewStepTitle')}</h2>
                <dl className="pp-bookReviewRows">
                  <div className="pp-bookReviewRows__row">
                    <dt>{t('bookConfirm.petLabel')}</dt>
                    <dd>{selectedPet?.name || '—'}</dd>
                  </div>
                  <div className="pp-bookReviewRows__row">
                    <dt>{t('bookConfirm.serviceLabel')}</dt>
                    <dd>{serviceName}</dd>
                  </div>
                  {selectedVariant ? (
                    <div className="pp-bookReviewRows__row">
                      <dt>{t('bookConfirm.variantLabel')}</dt>
                      <dd>{t(selectedVariant.labelKey)}</dd>
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
              disabled={stepIndex === 0 || busy}
              onClick={goBack}
            >
              {t('bookConfirm.wizardBack')}
            </button>
            {stepKey === 'review' ? (
              <button
                type="button"
                className="pp-bookConfirmForm__primary"
                disabled={busy || !petOptions.length || !slotId}
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

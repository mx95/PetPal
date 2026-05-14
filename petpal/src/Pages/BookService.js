import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { bookSlot, fetchOpenSlots } from '../bookings/bookingFirestore';
import { appleCalendarDataUrl, buildCalendarEvent, googleCalendarUrl } from '../bookings/calendarLinks';
import { getDemoProvider, getDemoServices, getDemoSlots } from '../bookings/demoBookingData';
import { subscribePets } from '../pets/petsFirestore';

const TEST_BOOKINGS_KEY = 'petpal_test_bookings';

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

/** Keep native <input type="date"> within a sane window so iOS/Android do not show "out of range". */
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

function formatWhenLine(date) {
  if (!date) return '';
  const day = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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

function saveLocalTestBooking(row) {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEST_BOOKINGS_KEY) || '[]');
    const rows = Array.isArray(parsed) ? parsed : [];
    localStorage.setItem(TEST_BOOKINGS_KEY, JSON.stringify([row, ...rows].slice(0, 20)));
  } catch {
    // Local demo bookings are best-effort only.
  }
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

export default function BookService() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { providerId, serviceId } = useParams();
  const companyId = String(providerId || '');
  const uid = user?.uid || null;

  const [pets, setPets] = useState([]);
  const [petId, setPetId] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [afterDate, setAfterDate] = useState(() => clampAfterDateYmd(toLocalInputValue(new Date())));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const routeState = location.state && typeof location.state === 'object' ? location.state : null;
  const demoBooking = routeState?.demoBooking || null;
  const isDemo = Boolean(demoBooking);
  const demoProvider = demoBooking?.provider || getDemoProvider(companyId);
  const demoServices = useMemo(() => (isDemo ? getDemoServices(companyId) : []), [companyId, isDemo]);
  const demoService = demoBooking?.service || demoServices.find((s) => s.id === serviceId) || null;
  const petOptions = useMemo(
    () => (pets.length ? pets : isDemo ? [{ id: 'demo_pet', name: 'Demo pet', categoryId: 'dog' }] : []),
    [isDemo, pets]
  );

  useEffect(() => subscribePets(uid, setPets), [uid]);

  useEffect(() => {
    const st = location.state && typeof location.state === 'object' ? location.state : null;
    if (!st) return;
    const demoSlot = st?.demoBooking?.slot;
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

  const minAfterYmd = todayYmdLocal();
  const maxAfterYmd = maxAfterYmdLocal();

  useEffect(() => {
    const c = clampAfterDateYmd(afterDate);
    if (c !== afterDate) setAfterDate(c);
  }, [afterDate]);

  const refresh = async () => {
    setErr('');
    try {
      const rows = isDemo
        ? getDemoSlots(companyId, String(serviceId || ''), { after })
        : await fetchOpenSlots(companyId, String(serviceId || ''), { after });
      setSlots(rows);
      setSlotId((prev) => {
        if (rows.some((r) => r.id === prev)) return prev;
        return rows.length ? rows[0].id : '';
      });
    } catch (e) {
      setErr(e?.message || 'failed');
    }
  };

  useEffect(() => {
    if (!companyId || !serviceId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, serviceId, afterDate]);

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

  const onBook = async () => {
    setErr('');
    setBusy(true);
    try {
      const pet = petOptions.find((p) => p.id === petId);
      const slot = slots.find((s) => s.id === slotId) || null;
      if (isDemo) {
        const bookingId = `test_${Date.now()}`;
        const row = {
          id: bookingId,
          bookingId,
          companyId,
          serviceId,
          slotId,
          customerUid: uid,
          petId,
          petName: pet?.name || 'Demo pet',
          petSnapshot: { name: pet?.name || 'Demo pet', categoryId: pet?.categoryId || 'dog' },
          providerName: demoProvider?.displayName || routeState?.providerName || 'PetPal partner',
          providerAddress: demoProvider?.address || routeState?.providerAddress || '',
          serviceName: demoService?.name || routeState?.serviceName || 'Appointment',
          startAtIso: slot?.startAtIso || slot?.startAt?.toDate?.()?.toISOString?.(),
          endAtIso: slot?.endAtIso || slot?.endAt?.toDate?.()?.toISOString?.(),
          startAt: slot?.startAt || null,
          endAt: slot?.endAt || null,
          durationMin: demoService?.durationMin ?? durationBetween(asDate(slot?.startAt), asDate(slot?.endAt)),
          status: 'confirmed',
          createdAtIso: new Date().toISOString(),
        };
        saveLocalTestBooking(row);
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
        providerName: routeState?.providerName || 'PetPal partner',
        providerAddress: routeState?.providerAddress || '',
        serviceName: routeState?.serviceName || 'Appointment',
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
    <div className="pp-bookConfirmPage">
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
              <div className="pp-bookConfirmPass__row">
                <dt>{t('bookConfirm.whenLabel')}</dt>
                <dd>{bookingStart ? formatWhenLine(bookingStart) : '—'}</dd>
              </div>
              {bookingDuration != null ? (
                <div className="pp-bookConfirmPass__row">
                  <dt>{t('bookConfirm.durationLabel')}</dt>
                  <dd>{t('bookConfirm.mins', { n: bookingDuration })}</dd>
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
                  <code className="pp-bookConfirmPass__code">{String(confirmedBooking.bookingId || confirmedBooking.id)}</code>
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

          <button type="button" className="pp-bookConfirmPage__textCta" onClick={() => navigate('/bookings', { replace: true })}>
            {t('bookConfirm.backBookings')}
          </button>
        </>
      ) : null}

      {!confirmedBooking ? (
        <section className="pp-bookConfirmForm">
          <h2 className="pp-bookConfirmForm__title">{t('bookConfirm.sectionDetails')}</h2>

          <div className="pp-bookConfirmForm__fields">
            <label className="pp-bookConfirmField">
              <span className="pp-bookConfirmField__label">{t('bookConfirm.petField')}</span>
              {petOptions.length ? (
                <select
                  className="pp-bookConfirmField__control"
                  value={petId}
                  onChange={(e) => setPetId(e.target.value)}
                >
                  {petOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="pp-bookConfirmField__empty">
                  <p>{t('bookConfirm.noPetsLead')}</p>
                  <Link className="pp-bookConfirmPage__link" to="/pets#add-pet">
                    {t('bookConfirm.noPetsCta')}
                  </Link>
                </div>
              )}
            </label>

            <label className="pp-bookConfirmField">
              <span className="pp-bookConfirmField__label">{t('bookConfirm.dateField')}</span>
              <input
                className="pp-bookConfirmField__control"
                type="date"
                min={minAfterYmd}
                max={maxAfterYmd}
                value={afterDate}
                onChange={(e) => setAfterDate(clampAfterDateYmd(e.target.value || minAfterYmd))}
              />
            </label>

            <label className="pp-bookConfirmField">
              <span className="pp-bookConfirmField__label">{t('bookConfirm.slotField')}</span>
              {slots.length ? (
                <select className="pp-bookConfirmField__control" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                  {slots.map((s) => {
                    const start = asDate(s.startAt) || asDate(s.startAtIso);
                    return (
                      <option key={s.id} value={s.id}>
                        {start ? formatWhenLine(start) : s.id}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="pp-bookConfirmField__empty">{t('bookConfirm.noSlots')}</div>
              )}
            </label>
          </div>

          <div className="pp-bookConfirmForm__actions">
            <button
              type="button"
              className="pp-bookConfirmForm__primary"
              disabled={busy || !petOptions.length || !slotId}
              onClick={onBook}
            >
              {busy ? t('bookConfirm.submitting') : t('bookConfirm.ctaConfirm')}
            </button>
            <button
              type="button"
              className="pp-bookConfirmForm__ghost pp-bookConfirmForm__ghost--full"
              disabled={busy}
              onClick={() => navigate(`/bookings/provider/${encodeURIComponent(companyId)}`)}
            >
              {t('bookConfirm.cancel')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

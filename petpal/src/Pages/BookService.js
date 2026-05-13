import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { bookSlot, fetchOpenSlots } from '../bookings/bookingFirestore';
import { appleCalendarDataUrl, buildCalendarEvent, googleCalendarUrl } from '../bookings/calendarLinks';
import { getDemoProvider, getDemoServices, getDemoSlots } from '../bookings/demoBookingData';
import { subscribePets } from '../pets/petsFirestore';

const TEST_BOOKINGS_KEY = 'petpal_test_bookings';

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

export default function BookService() {
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
  const [afterDate, setAfterDate] = useState(toLocalInputValue(new Date()));
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
    const ad = st?.afterDate;
    if (typeof ad === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ad)) setAfterDate(ad.slice(0, 10));
  }, [location.state]);

  useEffect(() => {
    if (!petId && petOptions.length) setPetId(petOptions[0].id);
  }, [petOptions, petId]);

  const after = useMemo(() => {
    const d = new Date(`${afterDate}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [afterDate]);

  const refresh = async () => {
    setErr('');
    try {
      const rows = isDemo
        ? getDemoSlots(companyId, String(serviceId || ''), { after })
        : await fetchOpenSlots(companyId, String(serviceId || ''), { after });
      setSlots(rows);
      if (rows.length) setSlotId(rows[0].id);
      else setSlotId('');
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
    if (typeof sid === 'string' && sid && slots.some((s) => s.id === sid)) setSlotId(sid);
  }, [location.state, slots]);

  if (!user) return <Navigate to="/login" replace />;

  const onBook = async () => {
    setErr('');
    setBusy(true);
    try {
      const pet = petOptions.find((p) => p.id === petId);
      const selectedSlot = slots.find((s) => s.id === slotId) || null;
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
          providerName: demoProvider?.displayName || routeState?.providerName || 'Demo provider',
          providerAddress: demoProvider?.address || routeState?.providerAddress || '',
          serviceName: demoService?.name || routeState?.serviceName || 'Demo appointment',
          startAtIso: selectedSlot?.startAtIso || selectedSlot?.startAt?.toDate?.()?.toISOString?.(),
          endAtIso: selectedSlot?.endAtIso || selectedSlot?.endAt?.toDate?.()?.toISOString?.(),
          status: 'test booked',
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
        providerName: routeState?.providerName || 'PetPal provider',
        providerAddress: routeState?.providerAddress || '',
        serviceName: routeState?.serviceName || 'PetPal appointment',
        startAt: selectedSlot?.startAt || null,
        endAt: selectedSlot?.endAt || null,
        status: 'booked',
      });
      setBusy(false);
    } catch (e) {
      setErr(e?.message || 'failed');
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="pp-pad pp-bookConfirm">
      <div className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <div className="pp-badge">Book</div>
          <div className="pp-pageHeader__title">Confirm your booking</div>
          <div className="pp-pageHeader__subtitle">Pick your pet and a time slot.</div>
        </div>
      </div>

      {err ? <div className="pp-error">{err}</div> : null}

      {confirmedBooking ? (
        <div className="pp-card pp-bookConfirm__success" style={{ marginTop: 14 }}>
          <div className="pp-bookConfirm__successIcon" aria-hidden>✓</div>
          <div className="pp-card__title">Booking confirmed</div>
          <p className="pp-muted">
            {confirmedBooking.serviceName} for {confirmedBooking.petName || confirmedBooking.petSnapshot?.name || 'your pet'}.
          </p>
          <div className="pp-bookConfirm__calendarActions">
            <a
              className="pp-btn pp-btn--primary"
              href={googleCalendarUrl(buildCalendarEvent(confirmedBooking))}
              target="_blank"
              rel="noopener noreferrer"
            >
              Add to Google Calendar
            </a>
            <a
              className="pp-btn pp-btn--ghost"
              href={appleCalendarDataUrl(buildCalendarEvent(confirmedBooking))}
              download="petpal-booking.ics"
            >
              Add to Apple Calendar
            </a>
            <button type="button" className="pp-btn pp-btn--ghost" onClick={() => navigate('/bookings', { replace: true })}>
              Back to bookings
            </button>
          </div>
        </div>
      ) : null}

      <div className="pp-card pp-bookConfirm__details" style={{ marginTop: 14 }}>
        <div className="pp-card__title">Booking details</div>

        <div className="pp-form">
          <label className="pp-field">
            <span className="pp-field__label">Pet</span>
            {petOptions.length ? (
              <select value={petId} onChange={(e) => setPetId(e.target.value)}>
                {petOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="pp-muted">
                No pets yet. <Link to="/pets">Add a pet</Link> first.
              </div>
            )}
          </label>

          <label className="pp-field">
            <span className="pp-field__label">Show slots after</span>
            <input type="date" value={afterDate} onChange={(e) => setAfterDate(e.target.value)} />
          </label>

          <label className="pp-field">
            <span className="pp-field__label">Time slot</span>
            {slots.length ? (
              <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.startAt?.toDate ? s.startAt.toDate().toLocaleString() : s.id}
                  </option>
                ))}
              </select>
            ) : (
              <div className="pp-muted">No open slots right now.</div>
            )}
          </label>

          <div className="pp-bookConfirm__formActions">
            <button
              type="button"
              className="pp-btn pp-btn--primary"
              disabled={busy || !petOptions.length || !slotId || Boolean(confirmedBooking)}
              onClick={onBook}
            >
              {isDemo ? 'Book test appointment' : 'Book now'}
            </button>
            <Link className="pp-btn pp-btn--ghost" to={`/bookings/provider/${companyId}`}>
              Back
            </Link>
            <button type="button" className="pp-btn pp-btn--ghost" onClick={refresh} disabled={busy}>
              Refresh slots
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


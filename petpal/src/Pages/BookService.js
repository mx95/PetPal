import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { bookSlot, fetchOpenSlots } from '../bookings/bookingFirestore';
import { subscribePets } from '../pets/petsFirestore';

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function BookService() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  useEffect(() => subscribePets(uid, setPets), [uid]);

  useEffect(() => {
    if (!petId && pets.length) setPetId(pets[0].id);
  }, [pets, petId]);

  const after = useMemo(() => {
    const d = new Date(`${afterDate}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [afterDate]);

  const refresh = async () => {
    setErr('');
    try {
      const rows = await fetchOpenSlots(companyId, String(serviceId || ''), { after });
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

  if (!user) return <Navigate to="/login" replace />;

  const onBook = async () => {
    setErr('');
    setBusy(true);
    try {
      const pet = pets.find((p) => p.id === petId);
      const bookingId = await bookSlot({
        companyId,
        serviceId,
        slotId,
        customerUid: uid,
        petId,
        petSnapshot: { name: pet?.name || '', categoryId: pet?.categoryId || 'dog' },
      });
      navigate(`/bookings`, { replace: true, state: { booked: bookingId } });
    } catch (e) {
      setErr(e?.message || 'failed');
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="pp-pad">
      <div className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <div className="pp-badge">Book</div>
          <div className="pp-pageHeader__title">Confirm your booking</div>
          <div className="pp-pageHeader__subtitle">Pick your pet and a time slot.</div>
        </div>
      </div>

      {err ? <div className="pp-error">{err}</div> : null}

      <div className="pp-card" style={{ marginTop: 14 }}>
        <div className="pp-card__title">Booking details</div>

        <div className="pp-form">
          <label className="pp-field">
            <span className="pp-field__label">Pet</span>
            {pets.length ? (
              <select value={petId} onChange={(e) => setPetId(e.target.value)}>
                {pets.map((p) => (
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

          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="pp-btn pp-btn--primary"
              disabled={busy || !pets.length || !slotId}
              onClick={onBook}
            >
              Book now
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


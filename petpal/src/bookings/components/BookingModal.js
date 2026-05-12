import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOpenSlots, subscribeCompanyServices } from '../bookingFirestore';
import { getDemoServices, getDemoSlots } from '../demoBookingData';
import { isFirebaseConfigured } from '../../firebase';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nextDays(n) {
  const out = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({ key: toYmd(d), date: d, label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) });
  }
  return out;
}

/**
 * @param {{
 *   open: boolean,
 *   provider: Record<string, unknown> | null,
 *   serviceTab: 'vet'|'saloon'|'hotel',
 *   onClose: () => void,
 *   t: (k: string, v?: object) => string,
 * }} props
 */
export function BookingModal({ open, provider, serviceTab, onClose, t }) {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [dayKey, setDayKey] = useState(() => toYmd(new Date()));
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotErr, setSlotErr] = useState('');

  const isDemo = provider && String(provider.id || '').startsWith('example_');
  const companyId = provider ? String(provider.id) : '';

  useEffect(() => {
    if (!open || !provider || !companyId) {
      setServices([]);
      setServiceId('');
      return undefined;
    }
    if (isDemo) {
      setServices(getDemoServices(companyId));
      return undefined;
    }
    if (!isFirebaseConfigured()) {
      setServices([]);
      setServiceId('');
      return undefined;
    }
    return subscribeCompanyServices(
      companyId,
      (rows) => setServices(Array.isArray(rows) ? rows : []),
      () => setServices([])
    );
  }, [open, provider, isDemo, companyId]);

  const filteredServices = useMemo(() => {
    const act = services.filter((s) => s && s.active !== false);
    const forTab = act.filter((s) => String(s.type || 'vet') === serviceTab);
    if (forTab.length) return forTab;
    return act;
  }, [services, serviceTab]);

  useEffect(() => {
    if (!filteredServices.length) {
      setServiceId('');
      return;
    }
    setServiceId((prev) => (filteredServices.some((s) => s.id === prev) ? prev : filteredServices[0].id));
  }, [filteredServices]);

  const days = useMemo(() => nextDays(14), []);

  useEffect(() => {
    if (!open || !companyId || !serviceId || !dayKey) {
      setSlots([]);
      setSlotId('');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingSlots(true);
      setSlotErr('');
      try {
        const after = new Date(`${dayKey}T00:00:00`);
        const rows = isDemo ? getDemoSlots(companyId, serviceId, { after }) : await fetchOpenSlots(companyId, serviceId, { after });
        if (cancelled) return;
        setSlots(rows);
        setSlotId(rows[0]?.id || '');
      } catch (e) {
        if (!cancelled) setSlotErr(e?.message || 'failed');
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isDemo, companyId, serviceId, dayKey]);

  useEffect(() => {
    if (!open) {
      setDayKey(toYmd(new Date()));
      setSlots([]);
      setSlotId('');
      setSlotErr('');
    }
  }, [open]);

  if (!open || !provider) return null;

  const onContinue = () => {
    if (!serviceId || !slotId) return;
    const selectedService = filteredServices.find((s) => s.id === serviceId) || null;
    const selectedSlot = slots.find((s) => s.id === slotId) || null;
    navigate(`/bookings/provider/${companyId}/book/${serviceId}`, {
      state: {
        afterDate: dayKey,
        slotId,
        providerName: String(provider.displayName || ''),
        providerAddress: String(provider.address || ''),
        serviceName: selectedService?.name || '',
        demoBooking: isDemo
          ? {
              provider,
              service: selectedService,
              slot: selectedSlot
                ? {
                    id: selectedSlot.id,
                    startAtIso: selectedSlot.startAtIso || selectedSlot.startAt?.toDate?.()?.toISOString?.(),
                    endAtIso: selectedSlot.endAtIso || selectedSlot.endAt?.toDate?.()?.toISOString?.(),
                  }
                : null,
            }
          : null,
      },
    });
    onClose();
  };

  return (
    <div className="pp-book-modalRoot" role="dialog" aria-modal="true" aria-labelledby="pp-book-modalTitle">
      <button type="button" className="pp-book-modalBackdrop" aria-label={t('bookingsHub.modalClose')} onClick={onClose} />
      <div className="pp-book-modalPanel">
        <div className="pp-book-modalHead">
          <div>
            <h2 id="pp-book-modalTitle" className="pp-book-modalTitle">
              {t('bookingsHub.modalTitle')}
            </h2>
            <p className="pp-book-modalSub">{String(provider.displayName || '')}</p>
            <p className="pp-book-modalAddr">{String(provider.address || '')}</p>
          </div>
          <button type="button" className="pp-book-iconBtn" onClick={onClose} aria-label={t('bookingsHub.modalClose')}>
            ×
          </button>
        </div>

        <>
          {isDemo ? <p className="pp-book-modalNote">Demo provider: you can book these test slots to try the full flow.</p> : null}
            <label className="pp-book-field">
              <span className="pp-book-field__label">{t('bookingsHub.modalSelectService')}</span>
              {filteredServices.length ? (
                <select className="pp-book-select" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  {filteredServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="pp-book-muted">{t('bookingsHub.modalNoServices')}</p>
              )}
            </label>

            <div className="pp-book-field">
              <span className="pp-book-field__label">{t('bookingsHub.modalPickDate')}</span>
              <div className="pp-book-dateRow">
                {days.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    className={`pp-book-dateChip ${d.key === dayKey ? 'is-active' : ''}`}
                    onClick={() => setDayKey(d.key)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pp-book-field">
              <span className="pp-book-field__label">{t('bookingsHub.modalPickSlot')}</span>
              {loadingSlots ? <p className="pp-book-muted">{t('bookingsHub.modalLoadingSlots')}</p> : null}
              {slotErr ? <p className="pp-book-error">{slotErr}</p> : null}
              {!loadingSlots && !slotErr && !slots.length ? (
                <p className="pp-book-muted">{t('bookingsHub.modalNoSlots')}</p>
              ) : null}
              <div className="pp-book-slotGrid">
                {slots.map((sl) => {
                  const active = sl.id === slotId;
                  const label = sl.startAt?.toDate ? sl.startAt.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : sl.id;
                  return (
                    <button
                      key={sl.id}
                      type="button"
                      className={`pp-book-slot ${active ? 'is-active' : ''}`}
                      onClick={() => setSlotId(sl.id)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
        </>

        <div className="pp-book-modalActions">
          <button type="button" className="pp-book-btn pp-book-btn--ghost" onClick={onClose}>
            {t('bookingsHub.modalClose')}
          </button>
          <button
            type="button"
            className="pp-book-btn pp-book-btn--primary"
            onClick={onContinue}
            disabled={!serviceId || !slotId}
          >
            {t('bookingsHub.modalContinue')}
          </button>
        </div>
      </div>
    </div>
  );
}

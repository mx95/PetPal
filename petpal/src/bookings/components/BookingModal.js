import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOpenSlots, subscribeCompanyServices } from '../bookingFirestore';
import { getDemoServices, getDemoSlots, isDemoClosedDay, nextOpenDemoDayYmd } from '../demoBookingData';
import { formatTime24 } from '../../formatTime24';
import { isFirebaseConfigured } from '../../firebase';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(date, count) {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

/** Monday-first calendar grid (Sunday in the last column, beside Saturday). */
function monthGrid(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = addDays(first, -mondayOffset);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return Array.from({ length: 42 }, (_, idx) => {
    const date = addDays(start, idx);
    return {
      key: toYmd(date),
      date,
      inMonth: date.getMonth() === monthDate.getMonth(),
      isPast: date < todayStart,
      isSunday: date.getDay() === 0,
    };
  });
}

function calendarDowLabels() {
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) =>
    addDays(monday, i).toLocaleDateString(undefined, { weekday: 'narrow' })
  );
}

function slotDate(slot, key) {
  const v = slot?.[key];
  if (v?.toDate) return v.toDate();
  if (slot?.[`${key}Iso`]) return new Date(slot[`${key}Iso`]);
  return null;
}

function slotPeriod(slot) {
  const start = slotDate(slot, 'startAt');
  const h = start ? start.getHours() : 12;
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

/**
 * @param {{
 *   open: boolean,
 *   provider: Record<string, unknown> | null,
 *   serviceTab: 'vet'|'saloon'|'hotel'|'bath',
 *   onClose: () => void,
 *   t: (k: string, v?: object) => string,
 * }} props
 */
export function BookingModal({ open, provider, serviceTab, onClose, t }) {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [dayKey, setDayKey] = useState(() => toYmd(new Date()));
  const [monthDate, setMonthDate] = useState(() => new Date());
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
    const forTab = act.filter((s) => {
      const type = String(s.type || 'vet');
      if (serviceTab === 'bath') return type === 'bath' || /bath/i.test(String(s.name || ''));
      return type === serviceTab;
    });
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

  const monthDays = useMemo(() => {
    return monthGrid(monthDate).map((d) => ({
      ...d,
      isClosed: Boolean(isDemo && isDemoClosedDay(companyId, d.date)),
    }));
  }, [monthDate, isDemo, companyId]);
  const dowLabels = useMemo(() => calendarDowLabels(), []);
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedService = useMemo(() => filteredServices.find((s) => s.id === serviceId) || null, [filteredServices, serviceId]);
  const uniqueSlots = useMemo(() => {
    const seen = new Set();
    return slots.filter((sl) => {
      const start = slotDate(sl, 'startAt');
      const key = start ? start.toISOString() : sl.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [slots]);
  const groupedSlots = useMemo(() => {
    return uniqueSlots.reduce((acc, sl) => {
      const key = slotPeriod(sl);
      acc[key] = acc[key] || [];
      acc[key].push(sl);
      return acc;
    }, {});
  }, [uniqueSlots]);

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
        const sameDayRows = rows.filter((slot) => {
          const start = slotDate(slot, 'startAt');
          return start ? toYmd(start) === dayKey : true;
        });
        if (cancelled) return;
        setSlots(sameDayRows);
        setSlotId(sameDayRows[0]?.id || '');
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
      setSlots([]);
      setSlotId('');
      setSlotErr('');
      return;
    }
    const today = new Date();
    const initialYmd = isDemo && companyId ? nextOpenDemoDayYmd(companyId, today) : toYmd(today);
    setDayKey(initialYmd);
    setMonthDate(new Date(`${initialYmd}T12:00:00`));
  }, [open, companyId, isDemo]);

  if (!open || !provider) return null;

  const onContinue = () => {
    if (!serviceId || !slotId) return;
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

        <div className="pp-book-modalBody">
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

            <div className="pp-book-field pp-book-calendar">
              <div className="pp-book-calendar__head">
                <span className="pp-book-field__label">{t('bookingsHub.modalPickDate')}</span>
                <div className="pp-book-calendar__monthControls" aria-label="Change month">
                  <button type="button" onClick={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>‹</button>
                  <strong>{monthLabel}</strong>
                  <button type="button" onClick={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>›</button>
                </div>
              </div>
              <div className="pp-book-calendarGrid pp-book-calendarGrid--monFirst" role="grid" aria-label={monthLabel}>
                {dowLabels.map((label, idx) => (
                  <span
                    key={`dow-${idx}`}
                    className={`pp-book-calendarGrid__dow${idx === 6 ? ' pp-book-calendarGrid__dow--sun' : ''}`}
                  >
                    {label}
                  </span>
                ))}
                {monthDays.map((d) => {
                  const dayClasses = [
                    'pp-book-calendarDay',
                    d.key === dayKey ? 'is-active' : '',
                    !d.inMonth ? 'is-muted' : '',
                    d.isSunday ? 'is-sunday' : '',
                    d.isClosed ? 'is-closed' : '',
                    d.isPast && !d.isClosed ? 'is-past' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <button
                      key={d.key}
                      type="button"
                      className={dayClasses}
                      onClick={() => {
                        setDayKey(d.key);
                        setMonthDate(new Date(d.date.getFullYear(), d.date.getMonth(), 1));
                        setSlotId('');
                      }}
                      disabled={d.isPast || d.isClosed}
                      aria-label={
                        d.isClosed
                          ? t('bookingsHub.modalClosedDay', { date: d.date.toLocaleDateString() })
                          : undefined
                      }
                      title={d.isClosed ? t('bookingsHub.modalClosedDayShort') : undefined}
                    >
                      {d.date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pp-book-field">
              <span className="pp-book-field__label">{t('bookingsHub.modalPickSlot')}</span>
              {selectedService ? (
                <p className="pp-book-muted pp-book-muted--sm" style={{ marginTop: 4 }}>
                  {selectedService.durationMin || 30} mins
                </p>
              ) : null}
              {loadingSlots ? <p className="pp-book-muted">{t('bookingsHub.modalLoadingSlots')}</p> : null}
              {slotErr ? <p className="pp-book-error">{slotErr}</p> : null}
              {!loadingSlots && !slotErr && !slots.length ? (
                <p className="pp-book-muted">{t('bookingsHub.modalNoSlots')}</p>
              ) : null}
              {['Morning', 'Afternoon', 'Evening'].map((period) =>
                groupedSlots[period]?.length ? (
                  <div key={period} className="pp-book-slotPeriod">
                    <div className="pp-book-slotPeriod__title">{period}</div>
                    <div className="pp-book-slotGrid pp-book-slotGrid--premium">
                      {groupedSlots[period].map((sl) => {
                        const active = sl.id === slotId;
                        const startDate = slotDate(sl, 'startAt');
                        const endDate = slotDate(sl, 'endAt');
                        return (
                          <button
                            key={sl.id}
                            type="button"
                            className={`pp-book-slot pp-book-slot--rich ${active ? 'is-active' : ''}`}
                            onClick={() => setSlotId(sl.id)}
                          >
                            <strong>{startDate ? formatTime24(startDate) : sl.id}</strong>
                            <span>{selectedService?.durationMin || 30} mins</span>
                            <small>{endDate ? `Ends ${formatTime24(endDate)}` : 'Finish time set after booking'}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null
              )}
            </div>
        </div>

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

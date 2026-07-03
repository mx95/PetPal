import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { subscribeProviderBookings, subscribeCompanyServices } from '../bookings/bookingFirestore';
import { formatDateTime24, formatTime24 } from '../formatTime24';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function weekDays(date) {
  const selected = startOfDay(date);
  const start = addDays(selected, -selected.getDay());
  return Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
}

function dateKey(date) {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bookingDate(booking) {
  if (booking.startAt?.toDate) return booking.startAt.toDate();
  if (booking.startAt instanceof Date) return booking.startAt;
  return null;
}

/**
 * Business home: weekly booking calendar (replaces Activity tab for approved companies).
 */
export default function BusinessWeekBookings() {
  const { user } = useAuth();
  const { profile, isApprovedCompany, isPendingCompany, isRejectedCompany } = useCompany();
  const { t } = useI18n();
  const companyId = user?.uid || null;

  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [err, setErr] = useState('');
  const [weekAnchor, setWeekAnchor] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    if (!companyId) return undefined;
    return subscribeProviderBookings(companyId, setBookings, (e) => setErr(e?.message || 'failed'));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return undefined;
    return subscribeCompanyServices(companyId, setServices, () => {});
  }, [companyId]);

  const servicesById = useMemo(() => {
    const m = new Map();
    services.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [services]);

  const weekStart = useMemo(() => {
    const d = startOfDay(weekAnchor);
    return addDays(d, -d.getDay());
  }, [weekAnchor]);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(() => weekDays(weekAnchor), [weekAnchor]);

  const bookingsInWeek = useMemo(() => {
    const startMs = weekStart.getTime();
    const endMs = addDays(weekEnd, 1).getTime();
    return bookings.filter((b) => {
      const d = bookingDate(b);
      if (!d) return false;
      const ms = d.getTime();
      return ms >= startMs && ms < endMs && String(b.status || '').toLowerCase() !== 'cancelled';
    });
  }, [bookings, weekStart, weekEnd]);

  const bookingsByDay = useMemo(() => {
    const grouped = new Map();
    bookingsInWeek.forEach((b) => {
      const d = bookingDate(b);
      if (!d) return;
      const key = dateKey(d);
      const rows = grouped.get(key) || [];
      rows.push(b);
      grouped.set(key, rows);
    });
    grouped.forEach((rows) => rows.sort((a, b) => (bookingDate(a)?.getTime() || 0) - (bookingDate(b)?.getTime() || 0)));
    return grouped;
  }, [bookingsInWeek]);

  const selectedKey = dateKey(selectedDate);
  const selectedBookings = bookingsByDay.get(selectedKey) || [];

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const shiftWeek = (delta) => {
    const next = addDays(weekAnchor, delta * 7);
    setWeekAnchor(next);
    setSelectedDate(startOfDay(next));
  };

  return (
    <div className="pp-feed pp-businessWeekBookings">
      {!profile ? (
        <section className="pp-card pp-pad" style={{ marginBottom: 14 }}>
          <p className="pp-muted" style={{ marginTop: 0, marginBottom: 10 }}>
            {t('businessWeek.applyPrompt')}
          </p>
          <Link className="pp-btn pp-btn--primary" to="/company/apply">
            {t('businessWeek.applyCta')}
          </Link>
        </section>
      ) : null}
      {isPendingCompany ? (
        <section className="pp-card pp-pad" style={{ marginBottom: 14 }}>
          <p className="pp-muted" style={{ marginTop: 0, marginBottom: 0 }}>
            {t('businessWeek.pendingBanner')}
          </p>
        </section>
      ) : null}
      {isRejectedCompany ? (
        <section className="pp-card pp-pad" style={{ marginBottom: 14 }}>
          <p className="pp-muted" style={{ marginTop: 0, marginBottom: 10 }}>
            {t('businessWeek.rejectedBanner')}
          </p>
          <Link className="pp-btn pp-btn--ghost" to="/company/apply">
            {t('businessWeek.reapplyCta')}
          </Link>
        </section>
      ) : null}
      <section className="pp-activityHub__block">
        <div className="pp-rowBetween" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="pp-badge">{t('businessWeek.badge')}</div>
            <h1 className="pp-h1" style={{ marginTop: 10, marginBottom: 4 }}>
              {profile?.businessName || t('businessWeek.title')}
            </h1>
            <p className="pp-subtle">{t('businessWeek.sub')}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Link className="pp-btn pp-btn--primary" to="/provider?tab=bookings">
              {t('businessWeek.managePortal')}
            </Link>
            {isApprovedCompany ? (
              <Link className="pp-btn pp-btn--ghost" to="/provider?tab=availability&add=1">
                {t('businessWeek.addAvailability')}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="pp-card pp-pad pp-providerCalendarPanel">
        <div className="pp-providerPanel__head">
          <div>
            <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
              {t('businessWeek.weekTitle')}
            </h2>
            <p className="pp-muted" style={{ marginTop: 4, marginBottom: 0 }}>
              {weekLabel}
            </p>
          </div>
          <div className="pp-providerCalendarControls">
            <button type="button" className="pp-btn pp-btn--ghost" onClick={() => shiftWeek(-1)} aria-label={t('businessWeek.prevWeek')}>
              ‹
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--ghost"
              onClick={() => {
                const today = startOfDay(new Date());
                setWeekAnchor(today);
                setSelectedDate(today);
              }}
            >
              {t('businessWeek.today')}
            </button>
            <button type="button" className="pp-btn pp-btn--ghost" onClick={() => shiftWeek(1)} aria-label={t('businessWeek.nextWeek')}>
              ›
            </button>
          </div>
        </div>

        {err ? <div className="pp-error">{err}</div> : null}

        <div className="pp-providerCalendarLayout">
          <div className="pp-providerCalendarCard">
            <div className="pp-providerCalendarWeek">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                <span key={`${d}-${idx}`}>{d}</span>
              ))}
            </div>
            <div className="pp-providerCalendarGrid is-week">
              {days.map((day) => {
                const key = dateKey(day);
                const dayBookings = bookingsByDay.get(key) || [];
                const isSelected = key === selectedKey;
                const isToday = key === dateKey(new Date());
                return (
                  <button
                    key={key}
                    type="button"
                    className={`${isSelected ? 'is-selected' : ''} ${dayBookings.length ? 'has-slots' : ''} ${isToday ? 'is-today' : ''}`}
                    onClick={() => setSelectedDate(startOfDay(day))}
                  >
                    <span>{day.getDate()}</span>
                    {dayBookings.length ? <em>{Math.min(dayBookings.length, 9)}</em> : null}
                  </button>
                );
              })}
            </div>
            <div className="pp-providerCalendarStrip" aria-label={t('businessWeek.weekTitle')}>
              {days.map((day) => {
                const key = dateKey(day);
                const count = (bookingsByDay.get(key) || []).length;
                return (
                  <button
                    key={`strip-${key}`}
                    type="button"
                    className={key === selectedKey ? 'is-selected' : ''}
                    onClick={() => setSelectedDate(startOfDay(day))}
                  >
                    <small>{day.toLocaleDateString(undefined, { weekday: 'short' })}</small>
                    <strong>{day.getDate()}</strong>
                    {count ? <em>{count}</em> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pp-providerDaySchedule">
            <div className="pp-providerDaySchedule__head">
              <span>{t('businessWeek.selectedDay')}</span>
              <strong>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
            </div>
            {selectedBookings.length === 0 ? (
              <div className="pp-providerCalendarEmpty">{t('businessWeek.noBookingsDay')}</div>
            ) : (
              <div className="pp-stack" style={{ marginTop: 8 }}>
                {selectedBookings.map((b) => {
                  const when = bookingDate(b);
                  const serviceName = b.serviceSnapshot?.name || servicesById.get(b.serviceId) || t('businessWeek.serviceFallback');
                  return (
                    <div key={b.id} className="pp-providerBookingCard pp-rowBetween pp-rowBetween--card">
                      <div>
                        <div style={{ fontWeight: 900 }}>{b.petSnapshot?.name || t('businessWeek.petFallback')}</div>
                        <div className="pp-muted" style={{ fontSize: 13 }}>
                          {serviceName} · {b.status || 'booked'}
                          {b.walkIn ? ' · Walk-in' : ''}
                        </div>
                        {b.petSnapshot?.ownerName ? (
                          <div className="pp-muted" style={{ fontSize: 13 }}>{b.petSnapshot.ownerName}</div>
                        ) : null}
                        <div className="pp-muted" style={{ fontSize: 13 }}>
                          {when ? formatDateTime24(when) : '—'}
                        </div>
                      </div>
                      <span className="pp-muted" style={{ fontSize: 13, fontWeight: 700 }}>
                        {when ? formatTime24(when) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {bookingsInWeek.length === 0 && !err ? (
          <p className="pp-muted" style={{ marginTop: 14, marginBottom: 0 }}>
            {t('businessWeek.noBookingsWeek')}
          </p>
        ) : null}
      </section>
    </div>
  );
}

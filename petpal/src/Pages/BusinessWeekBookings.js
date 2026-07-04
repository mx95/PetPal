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

function monthDays(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, idx) => addDays(start, idx));
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

function BookingList({ bookings, servicesById, t }) {
  if (!bookings.length) {
    return <div className="pp-providerCalendarEmpty">{t('businessWeek.noBookingsDay')}</div>;
  }
  return (
    <div className="pp-stack" style={{ marginTop: 8 }}>
      {bookings.map((b) => {
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
  );
}

/**
 * Business home: booking calendar with day, week, and month views.
 */
export default function BusinessWeekBookings() {
  const { user } = useAuth();
  const { profile, isApprovedCompany, isPendingCompany, isRejectedCompany } = useCompany();
  const { t } = useI18n();
  const companyId = user?.uid || null;

  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [err, setErr] = useState('');
  const [view, setView] = useState('week');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

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

  const activeBookings = useMemo(
    () => bookings.filter((b) => String(b.status || '').toLowerCase() !== 'cancelled'),
    [bookings]
  );

  const bookingsByDay = useMemo(() => {
    const grouped = new Map();
    activeBookings.forEach((b) => {
      const d = bookingDate(b);
      if (!d) return;
      const key = dateKey(d);
      const rows = grouped.get(key) || [];
      rows.push(b);
      grouped.set(key, rows);
    });
    grouped.forEach((rows) => rows.sort((a, b) => (bookingDate(a)?.getTime() || 0) - (bookingDate(b)?.getTime() || 0)));
    return grouped;
  }, [activeBookings]);

  const weekStart = useMemo(() => {
    const d = startOfDay(anchorDate);
    return addDays(d, -d.getDay());
  }, [anchorDate]);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekRow = useMemo(() => weekDays(anchorDate), [anchorDate]);
  const monthGrid = useMemo(() => monthDays(visibleMonth), [visibleMonth]);

  const selectedKey = dateKey(selectedDate);
  const selectedBookings = bookingsByDay.get(selectedKey) || [];

  const bookingsInWeek = useMemo(() => {
    const startMs = weekStart.getTime();
    const endMs = addDays(weekEnd, 1).getTime();
    return activeBookings.filter((b) => {
      const d = bookingDate(b);
      if (!d) return false;
      const ms = d.getTime();
      return ms >= startMs && ms < endMs;
    });
  }, [activeBookings, weekStart, weekEnd]);

  const bookingsInMonth = useMemo(() => {
    const startMs = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getTime();
    const endMs = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1).getTime();
    return activeBookings.filter((b) => {
      const d = bookingDate(b);
      if (!d) return false;
      const ms = d.getTime();
      return ms >= startMs && ms < endMs;
    });
  }, [activeBookings, visibleMonth]);

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const dayLabel = selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const goToday = () => {
    const today = startOfDay(new Date());
    setAnchorDate(today);
    setSelectedDate(today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const shiftAnchor = (deltaDays) => {
    const next = addDays(anchorDate, deltaDays);
    setAnchorDate(next);
    setSelectedDate(startOfDay(next));
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const selectDate = (day) => {
    const d = startOfDay(day);
    setSelectedDate(d);
    setAnchorDate(d);
    setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const renderDayButton = (day, { inMonth = true } = {}) => {
    const key = dateKey(day);
    const dayBookings = bookingsByDay.get(key) || [];
    const isSelected = key === selectedKey;
    const isToday = key === dateKey(new Date());
    return (
      <button
        key={key}
        type="button"
        className={`${isSelected ? 'is-selected' : ''} ${!inMonth ? 'is-muted' : ''} ${dayBookings.length ? 'has-slots' : ''} ${isToday ? 'is-today' : ''}`}
        onClick={() => selectDate(day)}
      >
        <span>{day.getDate()}</span>
        {dayBookings.length ? <em>{Math.min(dayBookings.length, 9)}</em> : null}
      </button>
    );
  };

  const periodTitle =
    view === 'day' ? dayLabel : view === 'month' ? monthLabel : weekLabel;

  const periodCount =
    view === 'day' ? selectedBookings.length : view === 'month' ? bookingsInMonth.length : bookingsInWeek.length;

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
      <section className="pp-activityHub__block pp-businessWeekBookings__hero">
        <div className="pp-rowBetween" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="pp-badge">{t('businessWeek.badge')}</div>
            <h1 className="pp-h1" style={{ marginTop: 10, marginBottom: 4 }}>
              {profile?.businessName || t('businessWeek.title')}
            </h1>
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

      <section className={`pp-card pp-pad pp-providerCalendarPanel ${view === 'month' ? 'pp-providerCalendarPanel--month' : ''}`}>
        <div className="pp-providerPanel__head">
          <div>
            <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
              {view === 'day' ? t('businessWeek.dayTitle') : view === 'month' ? t('businessWeek.monthTitle') : t('businessWeek.weekTitle')}
            </h2>
            <p className="pp-muted" style={{ marginTop: 4, marginBottom: 0 }}>
              {periodTitle}
            </p>
          </div>
          <div className="pp-providerCalendarControls">
            <div className="pp-providerCalendarToggle" aria-label={t('businessWeek.viewToggle')}>
              <button type="button" className={view === 'day' ? 'is-active' : ''} onClick={() => setView('day')}>
                {t('businessWeek.viewDay')}
              </button>
              <button type="button" className={view === 'week' ? 'is-active' : ''} onClick={() => setView('week')}>
                {t('businessWeek.viewWeek')}
              </button>
              <button type="button" className={view === 'month' ? 'is-active' : ''} onClick={() => setView('month')}>
                {t('businessWeek.viewMonth')}
              </button>
            </div>
            {view === 'day' ? (
              <>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={() => shiftAnchor(-1)} aria-label={t('businessWeek.prevDay')}>‹</button>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={goToday}>{t('businessWeek.today')}</button>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={() => shiftAnchor(1)} aria-label={t('businessWeek.nextDay')}>›</button>
              </>
            ) : view === 'week' ? (
              <>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={() => shiftAnchor(-7)} aria-label={t('businessWeek.prevWeek')}>‹</button>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={goToday}>{t('businessWeek.today')}</button>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={() => shiftAnchor(7)} aria-label={t('businessWeek.nextWeek')}>›</button>
              </>
            ) : (
              <>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label={t('businessWeek.prevMonth')}>‹</button>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={goToday}>{t('businessWeek.today')}</button>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label={t('businessWeek.nextMonth')}>›</button>
              </>
            )}
          </div>
        </div>

        {err ? <div className="pp-error">{err}</div> : null}

        <div className="pp-providerCalendarLayout">
          {view === 'day' ? (
            <div className="pp-providerDaySchedule pp-providerDaySchedule--full">
              <div className="pp-providerDaySchedule__head">
                <span>{t('businessWeek.selectedDay')}</span>
                <strong>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
              </div>
              <BookingList bookings={selectedBookings} servicesById={servicesById} t={t} />
            </div>
          ) : (
            <>
              <div className="pp-providerCalendarCard">
                {view === 'month' ? (
                  <>
                    <div className="pp-providerCalendarMobileMonth" aria-live="polite">
                      <div className="pp-providerCalendarMobileNav">
                        <button type="button" aria-label={t('businessWeek.prevMonth')} onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
                        <strong>{monthLabel}</strong>
                        <button type="button" aria-label={t('businessWeek.nextMonth')} onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
                      </div>
                    </div>
                    <div className="pp-providerCalendarWeek pp-providerCalendarWeek--desktop">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                        <span key={`${d}-${idx}`}>{d}</span>
                      ))}
                    </div>
                    <div className={`pp-providerCalendarGrid pp-providerCalendarGrid--desktopMonth`}>
                      {monthGrid.map((day) => renderDayButton(day, { inMonth: day.getMonth() === visibleMonth.getMonth() }))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="pp-providerCalendarWeek">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                        <span key={`${d}-${idx}`}>{d}</span>
                      ))}
                    </div>
                    <div className="pp-providerCalendarGrid is-week pp-providerCalendarGrid--mobileWeek">
                      {weekRow.map((day) => renderDayButton(day))}
                    </div>
                  </>
                )}
              </div>

              <div className="pp-providerDaySchedule">
                <div className="pp-providerDaySchedule__head">
                  <span>{t('businessWeek.selectedDay')}</span>
                  <strong>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
                </div>
                <BookingList bookings={selectedBookings} servicesById={servicesById} t={t} />
              </div>
            </>
          )}
        </div>

        {periodCount === 0 && !err ? (
          <p className="pp-muted" style={{ marginTop: 14, marginBottom: 0 }}>
            {view === 'day' ? t('businessWeek.noBookingsDay') : view === 'month' ? t('businessWeek.noBookingsMonth') : t('businessWeek.noBookingsWeek')}
          </p>
        ) : null}
      </section>
    </div>
  );
}

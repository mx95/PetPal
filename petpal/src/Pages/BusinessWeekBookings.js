import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { subscribeProviderBookings, subscribeCompanyServices } from '../bookings/bookingFirestore';
import BookingHeatCalendar from '../bookings/BookingHeatCalendar';
import {
  activeBookingsList,
  dateKey,
  groupBookingsByDay,
  startOfDay,
} from '../bookings/bookingHeatMap';
import { formatDateTime24, formatTime24 } from '../formatTime24';

function BookingList({ bookings, servicesById, t }) {
  if (!bookings.length) {
    return <div className="pp-providerCalendarEmpty">{t('businessWeek.noBookingsDay')}</div>;
  }
  return (
    <div className="pp-stack" style={{ marginTop: 8 }}>
      {bookings.map((b) => {
        const when = b.startAt?.toDate ? b.startAt.toDate() : b.startAt instanceof Date ? b.startAt : null;
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
 * Business home: month calendar with booking heat map and selected-day list.
 */
export default function BusinessWeekBookings() {
  const { user } = useAuth();
  const { profile, isApprovedCompany, isPendingCompany, isRejectedCompany } = useCompany();
  const { t } = useI18n();
  const companyId = user?.uid || null;

  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [err, setErr] = useState('');
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

  const bookingsByDay = useMemo(() => groupBookingsByDay(bookings), [bookings]);
  const selectedKey = dateKey(selectedDate);
  const selectedBookings = bookingsByDay.get(selectedKey) || [];

  const monthBookingCount = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    return activeBookingsList(bookings).filter((b) => {
      const d = b.startAt?.toDate ? b.startAt.toDate() : b.startAt instanceof Date ? b.startAt : null;
      return d && d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [bookings, selectedDate]);

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

      <section className="pp-card pp-pad pp-providerCalendarPanel pp-providerCalendarPanel--month">
        <div className="pp-providerPanel__head">
          <div>
            <h2 className="pp-sectionTitle" style={{ margin: 0 }}>{t('businessWeek.monthTitle')}</h2>
            <p className="pp-muted" style={{ marginTop: 4, marginBottom: 0 }}>
              Days are colored by booking load — green is lighter, red is busier.
            </p>
          </div>
        </div>

        {err ? <div className="pp-error">{err}</div> : null}

        <div className="pp-providerCalendarLayout">
          <BookingHeatCalendar
            bookings={bookings}
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            legendLabels={{
              fewer: t('businessWeek.bookingHeatFewer'),
              more: t('businessWeek.bookingHeatMore'),
            }}
          />

          <div className="pp-providerDaySchedule">
            <div className="pp-providerDaySchedule__head">
              <span>{t('businessWeek.selectedDay')}</span>
              <strong>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
            </div>
            <BookingList bookings={selectedBookings} servicesById={servicesById} t={t} />
          </div>
        </div>

        {monthBookingCount === 0 && !err ? (
          <p className="pp-muted" style={{ marginTop: 14, marginBottom: 0 }}>
            {t('businessWeek.noBookingsMonth')}
          </p>
        ) : null}
      </section>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import {
  subscribeProviderBookings,
  subscribeCompanyServices,
  updateBookingStatus,
} from '../bookings/bookingFirestore';
import { loadSchedulingContext } from '../bookings/availability/availabilityFirestore';
import BookingHeatCalendar from '../bookings/BookingHeatCalendar';
import ProviderBookingCard from '../bookings/ProviderBookingCard';
import { computeSlotCapacityByDay } from '../bookings/daySlotCapacity';
import {
  activeBookingsList,
  dateKey,
  groupBookingsByDay,
  monthDays,
  startOfDay,
} from '../bookings/bookingHeatMap';

function BookingList({ bookings, servicesById, t, busyId, onComplete, onCancel }) {
  if (!bookings.length) {
    return <div className="pp-providerCalendarEmpty">{t('businessWeek.noBookingsDay')}</div>;
  }
  return (
    <div className="pp-bookingDetailList">
      {bookings.map((b) => {
        const serviceName = b.serviceSnapshot?.name || servicesById.get(b.serviceId) || t('businessWeek.serviceFallback');
        return (
          <ProviderBookingCard
            key={b.id}
            booking={b}
            serviceName={serviceName}
            busy={busyId === b.id}
            onComplete={onComplete}
            onCancel={onCancel}
          />
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
  const [schedulingCtx, setSchedulingCtx] = useState(null);
  const [err, setErr] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    if (!companyId) return undefined;
    return subscribeProviderBookings(companyId, setBookings, (e) => setErr(e?.message || 'failed'));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return undefined;
    return subscribeCompanyServices(companyId, setServices, () => {});
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const ctx = await loadSchedulingContext(companyId);
        if (!cancelled) setSchedulingCtx(ctx);
      } catch {
        if (!cancelled) setSchedulingCtx(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const servicesById = useMemo(() => {
    const m = new Map();
    services.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [services]);

  const bookingsByDay = useMemo(() => groupBookingsByDay(bookings), [bookings]);
  const selectedKey = dateKey(selectedDate);
  const selectedBookings = bookingsByDay.get(selectedKey) || [];

  const visibleMonth = useMemo(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    [selectedDate]
  );

  const dayCapacityByKey = useMemo(() => {
    if (!schedulingCtx?.rules?.length) return new Map();
    const monthGrid = monthDays(visibleMonth);
    const firstDay = monthGrid[0];
    const lastDay = monthGrid[monthGrid.length - 1];
    const end = startOfDay(lastDay);
    end.setHours(23, 59, 59, 999);
    return computeSlotCapacityByDay({
      settings: schedulingCtx.settings,
      services,
      rules: schedulingCtx.rules,
      overrides: schedulingCtx.overrides,
      vacations: schedulingCtx.vacations,
      blockedPeriods: schedulingCtx.blockedPeriods,
      rangeStart: startOfDay(firstDay),
      rangeEnd: end,
    });
  }, [schedulingCtx, services, visibleMonth]);

  const monthBookingCount = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    return activeBookingsList(bookings).filter((b) => {
      const d = b.startAt?.toDate ? b.startAt.toDate() : b.startAt instanceof Date ? b.startAt : null;
      return d && d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [bookings, selectedDate]);

  const onBookingAction = async (bookingId, patch) => {
    setActionErr('');
    setBusyId(bookingId);
    try {
      await updateBookingStatus(bookingId, patch);
    } catch (e) {
      setActionErr(e?.message || 'Could not update booking.');
    } finally {
      setBusyId('');
    }
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
          </div>
        </div>

        {err ? <div className="pp-error">{err}</div> : null}
        {actionErr ? <div className="pp-error">{actionErr}</div> : null}

        <div className="pp-providerCalendarLayout">
          <BookingHeatCalendar
            bookings={bookings}
            dayCapacityByKey={dayCapacityByKey}
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
            <BookingList
              bookings={selectedBookings}
              servicesById={servicesById}
              t={t}
              busyId={busyId}
              onComplete={(id) => void onBookingAction(id, { status: 'completed' })}
              onCancel={(id) => void onBookingAction(id, { status: 'cancelled' })}
            />
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import {
  createProviderBooking,
  fetchOpenSlots,
  setSlotStatus,
  subscribeCompanyAvailability,
  subscribeCompanyServices,
  subscribeProviderBookings,
  swapBookingSlot,
  updateBookingStatus,
  upsertCompanyService,
} from '../bookings/bookingFirestore';
import { createClientPet, deleteClientPet, patchClientPet, subscribeClientPets } from '../bookings/providerPetsFirestore';
import PetMedicationModal from '../components/PetMedicationModal';
import IconMedPill from '../components/icons/IconMedPill';
import { useI18n } from '../i18n/I18nContext';
import { publishProviderProfile, setProviderBookingEnabled, subscribeProviderProfile } from '../bookings/providerDirectoryFirestore';
import { providerBookingsBoostIsActive, providerNearbyBoostIsActive } from '../bookings/bookingBrowseUtils';
import { getDemoBusinessAccount, getDemoBusinessAccounts, getDemoSlots } from '../bookings/demoBookingData';
import AvailabilityScheduler from '../bookings/availability/AvailabilityScheduler';
import { computeAvailableSlots, slotToFirestoreShape } from '../bookings/availability/availabilityEngine';
import {
  fetchBookingsInRange,
  fetchSchedulingSettings,
  loadSchedulingContext,
} from '../bookings/availability/availabilityFirestore';
import BookingHeatCalendar from '../bookings/BookingHeatCalendar';
import ProviderBookingCard from '../bookings/ProviderBookingCard';
import { addDays, daysFromMonday } from '../bookings/bookingHeatMap';
import ListingPlaceImportField from '../company/ListingPlaceImportField';
import { cancelBusinessBoost } from '../shop/cancelBusinessBoost';
import { formatDateTime24, formatTime24 } from '../formatTime24';
import {
  buildDefaultDurationMatrix,
  buildSizeFurVariants,
  durationMatrixKey,
  FUR_LENGTH_OPTIONS,
  PET_SIZE_OPTIONS,
} from '../bookings/bookingServiceVariants';

function businessTypeLabel(t, providerTypes = {}) {
  if (providerTypes.vet) return t('providerPortal.businessTypeVet');
  if (providerTypes.shop) return t('providerPortal.businessTypePetShop');
  if (providerTypes.park) return t('providerPortal.businessTypePetDogPark');
  if (providerTypes.hotel) return t('providerPortal.businessTypePetHotelBoarding');
  if (providerTypes.bath || providerTypes.saloon) return t('providerPortal.businessTypeGroomingBath');
  if (providerTypes.walker) return t('providerPortal.businessTypePetWalkers');
  if (providerTypes.daycare) return t('providerPortal.businessTypeDaycare');
  if (providerTypes.cafe) return t('providerPortal.businessTypePetCafeEvents');
  return t('providerPortal.businessTypeAllPetServices');
}

function businessIcon(providerTypes = {}) {
  if (providerTypes.vet) return '🩺';
  if (providerTypes.shop) return '🛍️';
  if (providerTypes.park) return '🌳';
  if (providerTypes.hotel) return '🏨';
  if (providerTypes.bath || providerTypes.saloon) return '🛁';
  if (providerTypes.walker) return '🦮';
  if (providerTypes.daycare) return '☀️';
  if (providerTypes.cafe) return '☕';
  return '🐾';
}

function serviceIcon(type) {
  if (type === 'vet') return '🩺';
  if (type === 'bath' || type === 'saloon') return '🛁';
  if (type === 'hotel') return '🏨';
  if (type === 'walker') return '🦮';
  if (type === 'shop') return '🛍️';
  if (type === 'daycare') return '☀️';
  if (type === 'cafe') return '☕';
  if (type === 'park') return '🌳';
  return '🐾';
}

function serviceTypeLabel(t, type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'vet') return t('providerPortal.serviceTypeVet');
  if (normalized === 'bath') return t('providerPortal.serviceTypeBath');
  if (normalized === 'saloon') return t('providerPortal.serviceTypeSaloon');
  if (normalized === 'hotel') return t('providerPortal.serviceTypeHotel');
  if (normalized === 'walker') return t('providerPortal.serviceTypePetWalker');
  if (normalized === 'shop') return t('providerPortal.serviceTypePetShop');
  if (normalized === 'daycare') return t('providerPortal.serviceTypeDaycare');
  if (normalized === 'cafe') return t('providerPortal.serviceTypePetCafe');
  if (normalized === 'park') return t('providerPortal.serviceTypeDogPark');
  return type || t('providerPortal.serviceFallback');
}

function bookingStatusText(t, status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'open') return t('providerPortal.statusAvailable');
  if (normalized === 'booked') return t('providerPortal.statusBooked');
  if (normalized === 'blocked') return t('providerPortal.statusBlocked');
  if (normalized === 'completed') return t('providerPortal.statusCompleted');
  if (normalized === 'cancelled') return t('providerPortal.statusCancelled');
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : t('providerPortal.statusAvailable');
}

function calendarPeriodLabel(t, period) {
  if (period === 'morning') return t('providerPortal.calendarMorning');
  if (period === 'afternoon') return t('providerPortal.calendarAfternoon');
  return t('providerPortal.calendarEvening');
}

function todayOpenSlotCountLabel(t, count) {
  return t(count === 1 ? 'providerPortal.todayOpenSlotCountOne' : 'providerPortal.todayOpenSlotCountOther', { count });
}

function visitCountLabel(t, count) {
  return t(count === 1 ? 'providerPortal.visitCountOne' : 'providerPortal.visitCountOther', { count });
}

function durationMinutesValueLabel(t, count) {
  return t('providerPortal.durationMinutesValue', { count });
}

function petSizeOptionLabel(t, sizeId) {
  if (sizeId === 'small') return t('providerPortal.petSizeSmall');
  if (sizeId === 'medium') return t('providerPortal.petSizeMedium');
  if (sizeId === 'large') return t('providerPortal.petSizeLarge');
  return sizeId;
}

function furLengthOptionLabel(t, furId) {
  if (furId === 'short') return t('providerPortal.furLengthShort');
  if (furId === 'medium') return t('providerPortal.furLengthMedium');
  if (furId === 'long') return t('providerPortal.furLengthLong');
  return furId;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthDays(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -daysFromMonday(first));
  return Array.from({ length: 42 }, (_, idx) => addDays(start, idx));
}

function weekDays(date) {
  const selected = startOfDay(date);
  const start = addDays(selected, -daysFromMonday(selected));
  return Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
}

function dateKey(date) {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PROVIDER_TABS = ['bookings', 'availability', 'customers', 'services'];

function buildPublishState(companyProfile, providerDoc, t) {
  const limitRaw = providerDoc?.bookingLimitPerDay;
  const hasLimit = limitRaw != null && Number(limitRaw) > 0;
  return {
    bookingEnabled: Boolean(providerDoc?.bookingEnabled),
    displayName: String(providerDoc?.displayName || companyProfile?.businessName || '').trim(),
    address: String(providerDoc?.address || companyProfile?.addressLine || '').trim(),
    phone: String(providerDoc?.phone || companyProfile?.phoneNumber || '').trim(),
    providerTypes:
      providerDoc?.providerTypes && typeof providerDoc.providerTypes === 'object'
        ? providerDoc.providerTypes
        : { vet: true, saloon: false, hotel: false, walker: false, shop: false },
    workingHours: providerDoc?.workingHours || companyProfile?.workingHours || t('providerPortal.workingHoursPlaceholder'),
    breakHours: providerDoc?.breakHours || t('providerPortal.breakHoursPlaceholder'),
    holidayClosures: providerDoc?.holidayClosures || '',
    staffCount: providerDoc?.staffCount || 1,
    slotIntervalMin: providerDoc?.slotIntervalMin || 30,
    bookingLimitEnabled: hasLimit,
    bookingLimitPerDay: hasLimit ? Number(limitRaw) : 12,
    holidayCountry: providerDoc?.holidayCountry || 'CY',
    boostNearbyEnabled: Boolean(providerDoc?.boostNearbyEnabled),
    boostBookingsEnabled: Boolean(providerDoc?.boostBookingsEnabled),
  };
}

function slotDate(slot) {
  if (!slot) return null;
  if (slot.startAtMs) return new Date(slot.startAtMs);
  if (slot.startAt?.toDate) return slot.startAt.toDate();
  if (slot.startAt instanceof Date) return slot.startAt;
  return null;
}

function slotEndDate(slot) {
  if (!slot) return null;
  if (slot.endAtMs) return new Date(slot.endAtMs);
  if (slot.endAt?.toDate) return slot.endAt.toDate();
  if (slot.endAt instanceof Date) return slot.endAt;
  return null;
}

function slotTimeLabel(slot) {
  const start = slotDate(slot);
  if (!start) return '';
  return formatTime24(start);
}

function slotPeriod(slot) {
  const start = slotDate(slot);
  const hour = start ? start.getHours() : 9;
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function CalendarAvailabilityPanel({
  slots,
  servicesById,
  bookings = [],
  onToggleSlot,
  addPanel,
  emptyText,
  selectedDate: controlledSelectedDate,
  onSelectedDateChange,
  initialShowAdd = false,
  hideAdd = false,
  heatLegendLabels,
}) {
  const { t, language } = useI18n();
  const locale = language || undefined;
  const firstSlotDate = slots.length ? slotDate(slots[0]) : null;
  const [internalSelectedDate, setInternalSelectedDate] = useState(() => firstSlotDate || new Date());
  const selectedDate = controlledSelectedDate ?? internalSelectedDate;
  const setSelectedDate = (day) => {
    if (onSelectedDateChange) onSelectedDateChange(startOfDay(day));
    else setInternalSelectedDate(startOfDay(day));
  };
  const [visibleMonth, setVisibleMonth] = useState(() => firstSlotDate || new Date());
  const [view, setView] = useState('week');
  const [showAdd, setShowAdd] = useState(initialShowAdd);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const weekdayHeaderDays = useMemo(() => weekDays(new Date()), []);

  const weekRowDays = useMemo(() => weekDays(selectedDate), [selectedDate]);
  const selectedKey = dateKey(selectedDate);

  const slotsByDay = useMemo(() => {
    const grouped = new Map();
    (slots || []).filter(Boolean).forEach((slot) => {
      const start = slotDate(slot);
      if (!start) return;
      const key = dateKey(start);
      const rows = grouped.get(key) || [];
      rows.push(slot);
      grouped.set(key, rows);
    });
    grouped.forEach((rows) => rows.sort((a, b) => (slotDate(a)?.getTime() || 0) - (slotDate(b)?.getTime() || 0)));
    return grouped;
  }, [slots]);

  const calendarDays =
    view === 'today'
      ? [startOfDay(new Date())]
      : view === 'week'
        ? weekRowDays
        : monthDays(visibleMonth);
  const mobileWeekDays = view === 'today' ? [startOfDay(new Date())] : weekRowDays;
  const selectedSlots = slotsByDay.get(selectedKey) || [];
  const periods = ['morning', 'afternoon', 'evening'];
  const monthLabel = visibleMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const mobileMonthLabel = selectedDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const emptyLabel = emptyText || t('providerPortal.noAvailabilityYet');

  const selectDate = (day) => {
    setSelectedDate(day);
    setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  const goToday = () => {
    const today = startOfDay(new Date());
    setView('today');
    selectDate(today);
  };

  const renderDayButton = (day, { compact = false } = {}) => {
    const key = dateKey(day);
    const daySlots = slotsByDay.get(key) || [];
    const isSelected = key === selectedKey;
    const inMonth = day.getMonth() === visibleMonth.getMonth();
    const isToday = key === dateKey(new Date());
    return (
      <button
        key={key}
        type="button"
        className={`${isSelected ? 'is-selected' : ''} ${!inMonth && view === 'month' && !compact ? 'is-muted' : ''} ${daySlots.length ? 'has-slots' : ''} ${isToday ? 'is-today' : ''}`}
        onClick={() => selectDate(day)}
      >
        {compact ? (
          <>
            <small>{day.toLocaleDateString(locale, { weekday: 'short' })}</small>
            <strong>{day.getDate()}</strong>
          </>
        ) : (
          <>
            <span>{day.getDate()}</span>
            {daySlots.length ? <em>{Math.min(daySlots.length, 9)}</em> : null}
          </>
        )}
      </button>
    );
  };

  return (
    <section className={`pp-providerPanel pp-providerCalendarPanel${view === 'month' ? ' pp-providerCalendarPanel--month' : ''}${view === 'today' ? ' pp-providerCalendarPanel--today' : ''}`}>
      <div className="pp-providerPanel__head">
        <div>
          <h2>{t('providerPortal.tabAvailability')}</h2>
        </div>
        <div className="pp-providerCalendarControls">
          <div className="pp-providerCalendarToggle" aria-label={t('providerPortal.calendarViewToggleAriaLabel')}>
            <button type="button" className={view === 'month' ? 'is-active' : ''} onClick={() => setView('month')}>{t('providerPortal.viewMonth')}</button>
            <button type="button" className={view === 'week' ? 'is-active' : ''} onClick={() => setView('week')}>{t('providerPortal.viewWeek')}</button>
            <button type="button" className={view === 'today' ? 'is-active' : ''} onClick={goToday}>{t('providerPortal.viewToday')}</button>
          </div>
          <button type="button" className="pp-btn pp-btn--primary" onClick={() => setShowAdd((v) => !v)} disabled={hideAdd} style={hideAdd ? { display: 'none' } : undefined}>+ {t('providerPortal.addAvailability')}</button>
        </div>
      </div>

      {showAdd ? (
        <div className="pp-providerAddSheet">
          <div className="pp-providerAddSheet__head">
            <strong>{t('providerPortal.quickAddAvailabilityTitle')}</strong>
            <button type="button" onClick={() => setShowAdd(false)}>{t('common.cancel')}</button>
          </div>
          {addPanel || <p>{t('providerPortal.quickAddAvailabilityHint')}</p>}
        </div>
      ) : null}

      <div className={`pp-providerCalendarLayout${view === 'today' ? ' pp-providerCalendarLayout--today' : ''}`}>
        {view === 'today' ? (
          <div className="pp-providerTodayBanner">
            <span className="pp-providerTodayBanner__label">{t('providerPortal.viewToday')}</span>
            <strong>{selectedDate.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
            <em>{selectedSlots.length ? todayOpenSlotCountLabel(t, selectedSlots.length) : t('providerPortal.noSlotsPublishedYet')}</em>
          </div>
        ) : (
        <div className="pp-providerCalendarCard">
          <div className="pp-providerCalendarMobileMonth" aria-live="polite">
            {view === 'month' ? (
              <div className="pp-providerCalendarMobileNav">
                <button type="button" aria-label={t('providerPortal.previousMonth')} onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
                <strong>{monthLabel}</strong>
                <button type="button" aria-label={t('providerPortal.nextMonth')} onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
              </div>
            ) : (
              <strong>{mobileMonthLabel}</strong>
            )}
          </div>
          {view !== 'today' ? (
            <div className="pp-providerCalendarCard__top pp-providerCalendarCard__top--desktop">
              <button type="button" aria-label={t('providerPortal.previousMonth')} onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
              <strong>{monthLabel}</strong>
              <button type="button" aria-label={t('providerPortal.nextMonth')} onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
            </div>
          ) : (
            <div className="pp-providerCalendarCard__top pp-providerCalendarCard__top--desktop pp-providerCalendarCard__top--today">
              <strong>{mobileMonthLabel}</strong>
            </div>
          )}
          {view === 'month' ? (
            <div className="pp-providerCalendarWeek pp-providerCalendarWeek--desktop">
              {weekdayHeaderDays.map((day) => (
                <span key={`desktop-head-${dateKey(day)}`}>{day.toLocaleDateString(locale, { weekday: 'narrow' })}</span>
              ))}
            </div>
          ) : null}
          {view === 'week' ? (
            <div className="pp-providerCalendarWeek pp-providerCalendarWeek--mobile">
              {mobileWeekDays.map((day) => (
                <span key={`head-${dateKey(day)}`}>{day.toLocaleDateString(locale, { weekday: 'narrow' })}</span>
              ))}
            </div>
          ) : null}
          <div className={`pp-providerCalendarGrid pp-providerCalendarGrid--desktopMonth ${view === 'week' || view === 'today' ? 'is-week' : ''}`}>
            {calendarDays.map((day) => renderDayButton(day))}
          </div>
          <div className={`pp-providerCalendarGrid is-week pp-providerCalendarGrid--mobileWeek`}>
            {mobileWeekDays.map((day) => renderDayButton(day))}
          </div>
        </div>
        )}

        <div className="pp-providerDaySchedule">
          <div className="pp-providerDaySchedule__head">
            <span>{t('providerPortal.selectedDate')}</span>
            <strong>{selectedDate.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
          </div>
          {selectedSlots.length === 0 ? <div className="pp-providerCalendarEmpty">{emptyLabel}</div> : null}
          {periods.map((period) => {
            const periodSlots = selectedSlots.filter((slot) => slotPeriod(slot) === period);
            if (!periodSlots.length) return null;
            return (
              <div key={period} className="pp-providerTimePeriod">
                <div className="pp-providerTimePeriod__title">{calendarPeriodLabel(t, period)}</div>
                <div className="pp-providerTimeSlots">
                  {periodSlots.map((slot) => {
                    const status = slot.status || 'open';
                    const end = slotEndDate(slot);
                    const serviceName = servicesById.get(slot.serviceId) || t('providerPortal.serviceFallback');
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        className={`is-${status} ${selectedSlotId === slot.id ? 'is-selected' : ''}`}
                        title={end ? t('providerPortal.serviceEndsTitle', { service: serviceName, time: formatTime24(end) }) : serviceName}
                        onClick={() => {
                          setSelectedSlotId(slot.id);
                          if (onToggleSlot) onToggleSlot(slot);
                        }}
                      >
                        <strong>{slotTimeLabel(slot) || t('providerPortal.slotFallback')}</strong>
                        <small>{bookingStatusText(t, status)}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DemoBusinessSwitcher({ businesses, onSelect, onSelectLive, activeId = '', compact = false, showLive = false }) {
  const { t } = useI18n();
  return (
    <section className={`pp-card pp-demoBusiness ${compact ? 'pp-demoBusiness--compact' : ''}`}>
      <div className="pp-rowBetween" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div className="pp-badge">{showLive && activeId ? t('providerPortal.demoPreviewBadge') : t('providerPortal.demoBusinessAccountsBadge')}</div>
          <h2 className="pp-sectionTitle" style={{ margin: '8px 0 4px' }}>
            {showLive && activeId ? t('providerPortal.viewingDemoTitle') : t('providerPortal.previewBusinessPerspectiveTitle')}
          </h2>
          <p className="pp-subtle" style={{ margin: 0 }}>
            {showLive && activeId
              ? t('providerPortal.demoReadOnlyMessage')
              : t('providerPortal.previewBusinessPerspectiveMessage')}
          </p>
        </div>
      </div>
      <div className="pp-demoBusiness__grid">
        {showLive ? (
          <button
            type="button"
            className={`pp-demoBusiness__card pp-demoBusiness__card--live ${!activeId ? 'is-active' : ''}`}
            onClick={() => onSelectLive?.()}
          >
            <span className="pp-demoBusiness__icon" aria-hidden>🏪</span>
            <span className="pp-demoBusiness__type">{t('providerPortal.liveAccount')}</span>
            <strong>{t('providerPortal.yourLiveBusiness')}</strong>
            <small>{t('providerPortal.manageServicesAvailability')}</small>
          </button>
        ) : null}
        {businesses.map((b) => (
          <button key={b.id} type="button" className={`pp-demoBusiness__card ${b.id === activeId ? 'is-active' : ''}`} onClick={() => onSelect(b.id)}>
            <span className="pp-demoBusiness__icon" aria-hidden>{businessIcon(b.providerTypes)}</span>
            <span className="pp-demoBusiness__type">{businessTypeLabel(t, b.providerTypes)}</span>
            <strong>{b.displayName}</strong>
            <small>{b.workingHours || t('providerPortal.openToday')}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProviderDashboardHero({ business, companyId, bookingEnabled = false }) {
  const { t } = useI18n();
  const customerPageTo = companyId
    ? `/bookings/provider/${encodeURIComponent(companyId)}`
    : '/bookings';
  return (
    <section className="pp-providerDashHero">
      <div className="pp-providerDashHero__banner" aria-hidden>
        <span>{businessIcon(business.providerTypes)}</span>
      </div>
      <div className="pp-providerDashHero__main">
        <div className="pp-providerDashHero__avatar" aria-hidden>{businessIcon(business.providerTypes)}</div>
        <div className="pp-providerDashHero__copy">
          <div className="pp-providerDashHero__badges">
            <span>{businessTypeLabel(t, business.providerTypes)}</span>
            <span className="is-live">{t('providerPortal.statusOpen')}</span>
            {bookingEnabled ? <span className="is-enabled">{t('providerPortal.activeForBooking')}</span> : null}
          </div>
          <h1>{business.displayName}</h1>
          <p>{business.address}</p>
        </div>
      </div>
      <div className="pp-providerDashHero__side">
        <Link className="pp-btn pp-btn--primary" to={customerPageTo}>
          {t('providerPortal.viewCustomerPage')}
        </Link>
        <div className="pp-providerDashHero__miniStats">
          <span>{t('providerPortal.heroServicesCount', { count: business.services.length })}</span>
          <span>{t('providerPortal.heroTodayCount', { count: business.bookings.length })}</span>
          <span>{t('providerPortal.heroClientsCount', { count: business.clientPets.length })}</span>
        </div>
      </div>
    </section>
  );
}

function ProviderStats({ business }) {
  const { t } = useI18n();
  const next = business.bookings[0]?.startAtLabel || business.nextAvailable || t('providerPortal.noUpcoming');
  return (
    <section className="pp-providerStats">
      <article><span aria-hidden>📅</span><small>{t('providerPortal.todaysBookings')}</small><strong>{business.bookings.length}</strong><em>{t('providerPortal.demoIncrease')}</em></article>
      <article><span aria-hidden>🧾</span><small>{t('providerPortal.activeServices')}</small><strong>{business.services.filter((s) => s.active !== false).length}</strong><em>{t('providerPortal.allBookable')}</em></article>
      <article><span aria-hidden>⏰</span><small>{t('providerPortal.upcoming')}</small><strong>{next}</strong><em>{t('providerPortal.nextAppointment')}</em></article>
      <article><span aria-hidden>🐾</span><small>{t('providerPortal.totalClients')}</small><strong>{business.clientPets.length}</strong><em>{t('providerPortal.trackedPetsDemo')}</em></article>
    </section>
  );
}

function ProviderTabs({ tab, setTab }) {
  const { t } = useI18n();
  const tabs = [
    ['bookings', t('providerPortal.tabBookings')],
    ['availability', t('providerPortal.tabAvailability')],
    ['customers', t('providerPortal.tabCustomers')],
    ['services', t('providerPortal.tabServices')],
  ];
  return (
    <div className="pp-providerTabs" role="tablist" aria-label={t('providerPortal.providerSectionsAria')}>
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={tab === id ? 'is-active' : ''}
          onClick={() => setTab(id)}
          role="tab"
          aria-selected={tab === id}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DemoServicesPanel({ services }) {
  const { t } = useI18n();
  return (
    <section className="pp-providerPanel">
      <div className="pp-providerPanel__head">
        <div>
          <h2>{t('providerPortal.servicesTitle')}</h2>
          <p>{t('providerPortal.servicesDemoDescription')}</p>
        </div>
        <button type="button" className="pp-btn pp-btn--primary" disabled>+ {t('providerPortal.addService')}</button>
      </div>
      <div className="pp-providerServiceGrid">
        {services.map((s) => (
          <article key={s.id} className="pp-providerServiceCard">
            <div className="pp-providerServiceCard__icon" aria-hidden>{serviceIcon(s.type)}</div>
            <div className="pp-providerServiceCard__body">
              <div className="pp-providerServiceCard__top">
                <h3>{s.name}</h3>
                <span className={s.active === false ? 'is-off' : 'is-on'}>{s.active === false ? t('providerPortal.inactive') : t('providerPortal.active')}</span>
              </div>
              <p>{s.description || t('providerPortal.noDescriptionYet')}</p>
              <div className="pp-providerServiceCard__meta">
                <span>{durationMinutesValueLabel(t, s.durationMin)}</span>
                <span>{serviceTypeLabel(t, s.type)}</span>
              </div>
            </div>
            <div className="pp-providerServiceCard__actions">
              <button type="button" disabled>{t('providerPortal.edit')}</button>
              <button type="button" disabled>{t('providerPortal.disable')}</button>
              <button type="button" disabled>{t('providerPortal.delete')}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemoAvailabilityPanel({ business, slots }) {
  const { t } = useI18n();
  const servicesById = useMemo(() => {
    const m = new Map();
    business.services.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [business.services]);
  return (
    <CalendarAvailabilityPanel
      slots={slots.map((slot, idx) => ({ ...slot, status: idx % 5 === 3 ? 'booked' : slot.status || 'open' }))}
      servicesById={servicesById}
      emptyText={t('providerPortal.demoSlotsEmptyState')}
    />
  );
}

function DemoBookingsPanel({ bookings }) {
  const { t } = useI18n();
  return (
    <section className="pp-providerPanel">
      <div className="pp-providerPanel__head">
        <div>
          <h2>{t('providerPortal.bookingsTitle')}</h2>
          <p>{t('providerPortal.demoBookingsDescription')}</p>
        </div>
      </div>
      <div className="pp-providerBookingList">
        {bookings.map((b) => (
          <article key={b.id} className="pp-providerBookingCard">
            <div className="pp-providerAvatar" aria-hidden>{b.petName.charAt(0)}</div>
            <div>
              <h3>{b.petName}</h3>
              <p>{b.serviceName}</p>
              <small>{b.ownerName} · {b.startAtLabel}</small>
            </div>
            <span className={`pp-providerStatus pp-providerStatus--${b.status}`}>{bookingStatusText(t, b.status)}</span>
            <div className="pp-providerBookingCard__actions">
              <button type="button" disabled>{t('providerPortal.complete')}</button>
              <button type="button" disabled>{t('common.cancel')}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemoClientPetsPanel({ pets }) {
  const { t } = useI18n();
  return (
    <section className="pp-providerPanel">
      <div className="pp-providerPanel__head">
        <div>
          <h2>{t('providerPortal.clientPetsTitle')}</h2>
          <p>{t('providerPortal.demoClientPetsDescription')}</p>
        </div>
      </div>
      <div className="pp-providerClientGrid">
        {pets.map((p) => (
          <article key={p.id} className="pp-providerClientCard">
            <div className="pp-providerAvatar" aria-hidden>{p.name.charAt(0)}</div>
            <div>
              <h3>{p.name}</h3>
              <p>{p.ownerName}</p>
              <small>{p.ownerPhone || t('providerPortal.noPhone')} · {p.trackingImei ? t('providerPortal.trackerLinked') : t('providerPortal.noTracker')}</small>
            </div>
            <a href={`tel:${p.ownerPhone || ''}`} className="pp-btn pp-btn--ghost">{t('providerPortal.contact')}</a>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemoProviderPortal({ business, businesses, onChangeBusiness, onExitDemo }) {
  const [tab, setTab] = useState('services');
  const firstService = business.services[0];
  const slots = firstService ? getDemoSlots(business.id, firstService.id, { after: new Date() }).slice(0, 6) : [];

  return (
    <div className="pp-pad pp-demoProviderPortal">
      <ProviderDashboardHero business={business} />

      <DemoBusinessSwitcher
        businesses={businesses}
        onSelect={onChangeBusiness}
        onSelectLive={onExitDemo}
        activeId={business.id}
        showLive
        compact
      />

      <ProviderStats business={business} />

      <ProviderTabs tab={tab} setTab={setTab} />

      <div className="pp-providerTabContent">
        {tab === 'services' ? <DemoServicesPanel services={business.services} /> : null}
        {tab === 'availability' ? <DemoAvailabilityPanel business={business} slots={slots} /> : null}
        {tab === 'bookings' ? <DemoBookingsPanel bookings={business.bookings} /> : null}
        {tab === 'clientPets' ? <DemoClientPetsPanel pets={business.clientPets} /> : null}
      </div>
    </div>
  );
}

export default function ProviderPortal() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { profile, profileLoading, isApprovedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const companyId = user?.uid || null;
  const demoBusinessId = searchParams.get('demoBusiness') || '';
  const demoBusinesses = useMemo(() => getDemoBusinessAccounts(), []);
  const demoBusiness = useMemo(() => getDemoBusinessAccount(demoBusinessId), [demoBusinessId]);

  const tabParam = searchParams.get('tab') || '';
  const initialTab = PROVIDER_TABS.includes(tabParam) ? tabParam : 'bookings';
  const [tab, setTabState] = useState(initialTab);
  const setTab = (next) => {
    const safe = PROVIDER_TABS.includes(next) ? next : 'bookings';
    setTabState(safe);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', safe);
        return p;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    if (PROVIDER_TABS.includes(tabParam) && tabParam !== tab) setTabState(tabParam);
  }, [tabParam, tab]);
  const [publishErr, setPublishErr] = useState('');
  const [publishBusy, setPublishBusy] = useState(false);
  const [boostCancelBusy, setBoostCancelBusy] = useState('');
  const [boostCancelMsg, setBoostCancelMsg] = useState('');
  const [providerDoc, setProviderDoc] = useState(null);
  const listingDirtyRef = useRef(false);
  const [publish, setPublish] = useState(() => buildPublishState(null, null, t));

  useEffect(() => {
    if (!companyId) return undefined;
    listingDirtyRef.current = false;
    return subscribeProviderProfile(companyId, setProviderDoc);
  }, [companyId]);

  useEffect(() => {
    if (profileLoading || !providerDoc) return;
    if (listingDirtyRef.current) return;
    setPublish(buildPublishState(profile, providerDoc, t));
  }, [profileLoading, profile, providerDoc, t]);

  if (demoBusiness) {
    return (
      <DemoProviderPortal
        business={demoBusiness}
        businesses={demoBusinesses}
        onChangeBusiness={(id) => setSearchParams({ demoBusiness: id, tab })}
        onExitDemo={() => {
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.delete('demoBusiness');
            return p;
          });
        }}
      />
    );
  }

  const canUse = Boolean(companyId) && isApprovedCompany;
  if (!user) return <Navigate to="/login" replace />;
  if (profileLoading) return <div className="pp-pad">{t('common.loading')}</div>;
  if (!canUse) {
    return (
      <div className="pp-pad">
        <div className="pp-pageHeader">
          <div className="pp-pageHeader__copy">
            <div className="pp-badge">{t('providerPortal.providerPortalBadge')}</div>
            <div className="pp-pageHeader__title">{t('providerPortal.notAvailableYet')}</div>
            <div className="pp-pageHeader__subtitle">
              {t('providerPortal.businessApprovalRequired')}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Link className="pp-btn pp-btn--primary" to="/company/apply">
            {t('providerPortal.applyAsBusiness')}
          </Link>
        </div>
        <DemoBusinessSwitcher businesses={demoBusinesses} onSelect={(id) => setSearchParams({ demoBusiness: id })} />
      </div>
    );
  }

  const nearbyBoostActive = providerNearbyBoostIsActive(providerDoc);
  const bookingsBoostActive = providerBookingsBoostIsActive(providerDoc);

  const onCancelBoost = async (kind) => {
    if (!companyId || !user?.uid) return;
    const ok = window.confirm(
      kind === 'nearby'
        ? t('providerPortal.cancelNearbyBoostConfirm')
        : t('providerPortal.cancelBookingsBoostConfirm')
    );
    if (!ok) return;
    setBoostCancelMsg('');
    setBoostCancelBusy(kind);
    try {
      await cancelBusinessBoost({ uid: user.uid, companyId, kind });
      setBoostCancelMsg(t('providerPortal.boostCancelledMessage'));
    } catch (e) {
      setBoostCancelMsg(e?.message || t('providerPortal.couldNotCancelBoost'));
    } finally {
      setBoostCancelBusy('');
    }
  };

  return (
    <div className="pp-pad pp-demoProviderPortal">
      <ProviderDashboardHero
        companyId={companyId}
        bookingEnabled={publish.bookingEnabled}
        business={{
          displayName: profile?.businessName || publish.displayName || t('providerPortal.businessFallback'),
          address: profile?.addressLine || publish.address || t('providerPortal.businessProfileFallback'),
          providerTypes: publish.providerTypes,
          services: [],
          bookings: [],
          clientPets: [],
          workingHours: publish.workingHours,
          nextAvailable: t('providerPortal.manageLiveAvailability'),
        }}
      />
      {/* Demo business preview hidden for live providers — use Bookings/Availability tabs directly. */}

      <div className="pp-providerHubShell">
        <div className="pp-providerTabsWrap">
          <ProviderTabs tab={tab} setTab={setTab} />
        </div>

        <div className="pp-providerTabContent">
          {tab === 'bookings' ? <Bookings companyId={companyId} /> : null}
          {tab === 'availability' ? (
            <Availability
              companyId={companyId}
              profile={profile}
              publish={publish}
              setPublish={setPublish}
              publishErr={publishErr}
              setPublishErr={setPublishErr}
              publishBusy={publishBusy}
              setPublishBusy={setPublishBusy}
              nearbyBoostActive={nearbyBoostActive}
              bookingsBoostActive={bookingsBoostActive}
              boostCancelBusy={boostCancelBusy}
              boostCancelMsg={boostCancelMsg}
              onCancelBoost={onCancelBoost}
              openAddPanel={searchParams.get('add') === '1'}
              holidayCountry={publish.holidayCountry || 'CY'}
              onHolidayCountryChange={(code) => setPublish((p) => ({ ...p, holidayCountry: code }))}
              onSaveHolidayCountry={async (code) => {
                await publishProviderProfile(companyId, { holidayCountry: code });
              }}
              onListingDirty={() => {
                listingDirtyRef.current = true;
              }}
              onListingSaved={() => {
                listingDirtyRef.current = false;
              }}
            />
          ) : null}
          {tab === 'customers' ? (
            <Customers companyId={companyId} clinicLabel={publish.displayName || profile?.businessName || ''} />
          ) : null}
          {tab === 'services' ? <Services companyId={companyId} /> : null}
        </div>
      </div>
    </div>
  );
}

const EMPTY_SERVICE_FORM = {
  type: 'vet',
  name: '',
  durationMin: 30,
  price: '',
  description: '',
  addOns: '',
  preparationNotes: '',
  active: true,
  askPetSize: false,
  askFurLength: false,
  durationMatrix: {},
};

function Services({ companyId }) {
  const { t } = useI18n();
  const [services, setServices] = useState([]);
  const [err, setErr] = useState('');
  const [toggleBusyId, setToggleBusyId] = useState('');
  const [form, setForm] = useState(() => ({ ...EMPTY_SERVICE_FORM }));

  useEffect(() => subscribeCompanyServices(companyId, setServices, (e) => setErr(e?.message || t('common.errorGeneric'))), [companyId, t]);

  const showSizeFurOptions = form.type === 'saloon' || form.type === 'bath';
  const askPetSize = showSizeFurOptions && form.askPetSize;
  const askFurLength = showSizeFurOptions && form.askFurLength;

  useEffect(() => {
    if (!showSizeFurOptions || (!form.askPetSize && !form.askFurLength)) return;
    setForm((p) => {
      const next = buildDefaultDurationMatrix(p.durationMin, p.askPetSize, p.askFurLength);
      const merged = { ...next };
      Object.keys(next).forEach((key) => {
        const existing = Number(p.durationMatrix?.[key]);
        if (Number.isFinite(existing) && existing >= 5) merged[key] = existing;
      });
      const same =
        Object.keys(merged).length === Object.keys(p.durationMatrix || {}).length &&
        Object.keys(merged).every((k) => Number(p.durationMatrix?.[k]) === Number(merged[k]));
      if (same) return p;
      return { ...p, durationMatrix: merged };
    });
  }, [showSizeFurOptions, form.askPetSize, form.askFurLength, form.durationMin]);

  const onCreate = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const payload = { ...form };
      const isBathGroom = payload.type === 'saloon' || payload.type === 'bath';
      payload.askPetSize = isBathGroom && Boolean(payload.askPetSize);
      payload.askFurLength = isBathGroom && Boolean(payload.askFurLength);
      if (payload.askPetSize || payload.askFurLength) {
        payload.variants = buildSizeFurVariants({
          baseDuration: payload.durationMin,
          basePrice: payload.price,
          askPetSize: payload.askPetSize,
          askFurLength: payload.askFurLength,
          durationMatrix: payload.durationMatrix,
        });
        payload.durationMatrix = { ...(payload.durationMatrix || {}) };
      } else {
        payload.variants = [];
        payload.durationMatrix = {};
      }
      await upsertCompanyService(companyId, null, payload);
      setForm({ ...EMPTY_SERVICE_FORM });
    } catch (e2) {
      setErr(e2?.message || t('common.errorGeneric'));
    }
  };

  return (
    <section className="pp-providerPanel">
      <div className="pp-providerPanel__head">
        <div>
          <h2>{t('providerPortal.servicesTitle')}</h2>
          <p>{t('providerPortal.servicesDescription')}</p>
        </div>
      </div>

      <div className="pp-providerFormCard">
        <h3 className="pp-providerFormCard__title">{t('providerPortal.createServiceTitle')}</h3>
        {err ? <div className="pp-error">{err}</div> : null}
        <form onSubmit={onCreate} className="pp-form pp-providerForm">
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.typeLabel')}</span>
              <select className="pp-input" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="vet">{serviceTypeLabel(t, 'vet')}</option>
                <option value="bath">{serviceTypeLabel(t, 'bath')}</option>
                <option value="saloon">{serviceTypeLabel(t, 'saloon')}</option>
                <option value="hotel">{serviceTypeLabel(t, 'hotel')}</option>
                <option value="walker">{serviceTypeLabel(t, 'walker')}</option>
              </select>
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.durationMinutesLabel')}</span>
              <input
                className="pp-input"
                type="number"
                min={5}
                value={form.durationMin}
                onChange={(e) => setForm((p) => ({ ...p, durationMin: Number(e.target.value) }))}
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.priceLabel')}</span>
              <input className="pp-input" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} placeholder={t('providerPortal.pricePlaceholder')} />
            </label>
          </div>
          <label className="pp-field">
            <span className="pp-field__label">{t('providerPortal.nameLabel')}</span>
            <input className="pp-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t('providerPortal.serviceNamePlaceholder')} />
          </label>
          <label className="pp-field">
            <span className="pp-field__label">{t('providerPortal.descriptionLabel')}</span>
            <textarea
              className="pp-input"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder={t('providerPortal.serviceDescriptionPlaceholder')}
            />
          </label>
          <label className="pp-field">
            <span className="pp-field__label">{t('providerPortal.optionalAddOnsLabel')}</span>
            <textarea className="pp-input" rows={2} value={form.addOns} onChange={(e) => setForm((p) => ({ ...p, addOns: e.target.value }))} placeholder={t('providerPortal.addOnsPlaceholder')} />
          </label>
          <label className="pp-field">
            <span className="pp-field__label">{t('providerPortal.preparationNotesLabel')}</span>
            <textarea className="pp-input" rows={2} value={form.preparationNotes} onChange={(e) => setForm((p) => ({ ...p, preparationNotes: e.target.value }))} placeholder={t('providerPortal.preparationNotesPlaceholder')} />
          </label>
          {showSizeFurOptions ? (
            <div className="pp-providerServiceOptions">
              <p className="pp-providerServiceOptions__lead">
                {t('providerPortal.bookingQuestionsLead')}
              </p>
              <label className="pp-field pp-field--checkbox">
                <input
                  type="checkbox"
                  checked={form.askPetSize}
                  onChange={(e) => setForm((p) => ({ ...p, askPetSize: e.target.checked }))}
                />
                <span>{t('providerPortal.askPetSize')}</span>
              </label>
              <label className="pp-field pp-field--checkbox">
                <input
                  type="checkbox"
                  checked={form.askFurLength}
                  onChange={(e) => setForm((p) => ({ ...p, askFurLength: e.target.checked }))}
                />
                <span>{t('providerPortal.askFurLength')}</span>
              </label>
              {askPetSize || askFurLength ? (
                <div className="pp-providerDurationMatrix">
                  <span className="pp-field__label">{t('providerPortal.durationBySelectionLabel')}</span>
                  <p className="pp-muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
                    {t('providerPortal.durationBySelectionHint')}
                  </p>
                  {askPetSize && askFurLength ? (
                    <div className="pp-providerDurationMatrix__tableWrap">
                      <table className="pp-providerDurationMatrix__table">
                        <thead>
                          <tr>
                            <th scope="col">{t('providerPortal.sizeByFurHeader')}</th>
                            {FUR_LENGTH_OPTIONS.map((fur) => (
                              <th key={fur.id} scope="col">
                                {furLengthOptionLabel(t, fur.id)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PET_SIZE_OPTIONS.map((size) => (
                            <tr key={size.id}>
                              <th scope="row">{petSizeOptionLabel(t, size.id)}</th>
                              {FUR_LENGTH_OPTIONS.map((fur) => {
                                const key = durationMatrixKey(size.id, fur.id);
                                return (
                                  <td key={key}>
                                    <input
                                      className="pp-input pp-providerDurationMatrix__input"
                                      type="number"
                                      min={5}
                                      step={5}
                                      aria-label={t('providerPortal.durationMatrixInputLabel', {
                                        size: petSizeOptionLabel(t, size.id),
                                        fur: furLengthOptionLabel(t, fur.id),
                                      })}
                                      value={form.durationMatrix?.[key] ?? ''}
                                      onChange={(e) => {
                                        const n = Number(e.target.value);
                                        setForm((p) => ({
                                          ...p,
                                          durationMatrix: {
                                            ...p.durationMatrix,
                                            [key]: Number.isFinite(n) ? n : p.durationMatrix?.[key],
                                          },
                                        }));
                                      }}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="pp-providerDurationMatrix__list">
                      {(askPetSize ? PET_SIZE_OPTIONS : FUR_LENGTH_OPTIONS).map((opt) => {
                        const key = durationMatrixKey(askPetSize ? opt.id : '', askFurLength ? opt.id : '');
                        return (
                          <label key={key} className="pp-field pp-providerDurationMatrix__row">
                            <span className="pp-field__label">{askPetSize ? petSizeOptionLabel(t, opt.id) : furLengthOptionLabel(t, opt.id)}</span>
                            <input
                              className="pp-input"
                              type="number"
                              min={5}
                              step={5}
                              value={form.durationMatrix?.[key] ?? ''}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                setForm((p) => ({
                                  ...p,
                                  durationMatrix: {
                                    ...p.durationMatrix,
                                    [key]: Number.isFinite(n) ? n : p.durationMatrix?.[key],
                                  },
                                }));
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="pp-field pp-field--checkbox">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
            />
            <span>{t('providerPortal.activeVisibleToCustomers')}</span>
          </label>
          <button className="pp-btn pp-btn--primary" type="submit">
            {t('providerPortal.addService')}
          </button>
        </form>
      </div>

      <div className="pp-providerServiceGrid" style={{ marginTop: 14 }}>
        {services.length === 0 ? <div className="pp-providerEmptyCard">{t('providerPortal.noServicesYet')}</div> : null}
        {services.map((s) => (
          <article key={s.id} className="pp-providerServiceCard">
            <div className="pp-providerServiceCard__icon" aria-hidden>{serviceIcon(s.type)}</div>
            <div className="pp-providerServiceCard__body">
              <div className="pp-providerServiceCard__top">
                <h3>{s.name}</h3>
                <span className={s.active === false ? 'is-off' : 'is-on'}>{s.active === false ? t('providerPortal.inactive') : t('providerPortal.active')}</span>
              </div>
              <p>{s.description || t('providerPortal.noDescriptionYet')}</p>
              <div className="pp-providerServiceCard__meta">
                <span>{durationMinutesValueLabel(t, s.durationMin)}</span>
                <span>{s.price || t('providerPortal.noPrice')}</span>
                <span>{serviceTypeLabel(t, s.type)}</span>
                {s.askPetSize ? <span>{t('providerPortal.petSize')}</span> : null}
                {s.askFurLength ? <span>{t('providerPortal.furLength')}</span> : null}
                {!s.askPetSize && !s.askFurLength && Array.isArray(s.variants) && s.variants.length ? (
                  <span>{t('providerPortal.variantOptionsCount', { count: s.variants.length })}</span>
                ) : null}
              </div>
            </div>
            <div className="pp-providerServiceCard__actions">
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                disabled={toggleBusyId === s.id}
                onClick={async () => {
                  setErr('');
                  setToggleBusyId(s.id);
                  try {
                    const nextActive = s.active === false;
                    await upsertCompanyService(companyId, s.id, { active: nextActive });
                  } catch (e) {
                    setErr(e?.message || t('providerPortal.couldNotUpdateService'));
                  } finally {
                    setToggleBusyId('');
                  }
                }}
              >
                {toggleBusyId === s.id ? t('providerPortal.saving') : s.active === false ? t('providerPortal.enable') : t('providerPortal.disable')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PublicListingPanel({
  companyId,
  profile,
  publish,
  setPublish,
  publishErr,
  setPublishErr,
  publishBusy,
  setPublishBusy,
  nearbyBoostActive,
  bookingsBoostActive,
  boostCancelBusy,
  boostCancelMsg,
  onCancelBoost,
  onListingDirty,
  onListingSaved,
}) {
  const { t } = useI18n();
  const [toggleBusy, setToggleBusy] = useState(false);

  const onBookingToggle = async (nextEnabled) => {
    setPublish((p) => ({ ...p, bookingEnabled: nextEnabled }));
    setPublishErr('');
    setToggleBusy(true);
    try {
      await setProviderBookingEnabled(companyId, nextEnabled);
    } catch (err) {
      setPublish((p) => ({ ...p, bookingEnabled: !nextEnabled }));
      setPublishErr(err?.message || t('providerPortal.couldNotUpdateBookingStatus'));
    } finally {
      setToggleBusy(false);
    }
  };

  const markDirty = () => onListingDirty?.();

  return (
    <section className="pp-providerPanel pp-providerListingSection">
      <div className="pp-providerPanel__head">
        <div>
          <h2>{t('providerPortal.publicListingTitle')}</h2>
          <p>{t('providerPortal.publicListingDescription')}</p>
        </div>
      </div>

      <div className="pp-providerFormCard">
        {publishErr ? <div className="pp-error">{publishErr}</div> : null}
        <form
          className="pp-form pp-providerForm"
          onSubmit={async (e) => {
            e.preventDefault();
            setPublishErr('');
            setPublishBusy(true);
            try {
              await publishProviderProfile(companyId, publish);
              onListingSaved?.();
            } catch (err) {
              setPublishErr(err?.message || t('common.errorGeneric'));
            } finally {
              setPublishBusy(false);
            }
          }}
        >
          <div className="pp-providerBoostToggle pp-providerListingToggle">
            <div className="pp-providerBoostToggle__copy">
              <strong>{t('providerPortal.activeForBooking')}</strong>
              <small>{t('providerPortal.activeForBookingDescription')}</small>
            </div>
            <label className={`pp-providerBoostSwitch${publish.bookingEnabled ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={publish.bookingEnabled}
                disabled={toggleBusy || publishBusy}
                onChange={(e) => void onBookingToggle(e.target.checked)}
              />
              <span aria-hidden />
            </label>
          </div>
          <fieldset className="pp-field">
            <legend className="pp-field__label">{t('providerPortal.categoriesShownInBookingsSearch')}</legend>
            <p className="pp-muted" style={{ fontSize: 13, marginBottom: 8 }}>
              {t('providerPortal.categoriesShownHint')}
            </p>
            <div className="pp-providerTypePills" role="group" aria-label={t('providerPortal.serviceCategoriesAriaLabel')}>
              {[
                { key: 'vet', label: t('providerPortal.serviceTypeVet'), emoji: '🩺' },
                { key: 'walker', label: t('providerPortal.businessTypePetWalkers'), emoji: '🦮' },
                { key: 'bath', label: t('providerPortal.categoryBathWash'), emoji: '🛁' },
                { key: 'saloon', label: t('providerPortal.categoryGrooming'), emoji: '✂️' },
                { key: 'hotel', label: t('providerPortal.categoryPetHotel'), emoji: '🏨' },
              ].map(({ key, label, emoji }) => {
                const on = Boolean(publish.providerTypes?.[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`pp-book-pill pp-providerTypePill${on ? ' is-active' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      markDirty();
                      setPublish((p) => ({
                        ...p,
                        providerTypes: { ...p.providerTypes, [key]: !on },
                      }));
                    }}
                  >
                    <span className="pp-book-pill__emoji" aria-hidden>
                      {emoji}
                    </span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="pp-field">
            <span className="pp-field__label">{t('providerPortal.importFromMapPin')}</span>
            <ListingPlaceImportField
              profile={profile}
              onImport={(data) => {
                markDirty();
                setPublish((p) => ({
                  ...p,
                  displayName: data.displayName || p.displayName,
                  address: data.address || p.address,
                  phone: data.phone || p.phone,
                  workingHours: data.workingHours || p.workingHours,
                }));
              }}
            />
          </div>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.displayNameLabel')}</span>
              <input
                className="pp-input"
                value={publish.displayName}
                onChange={(e) => {
                  markDirty();
                  setPublish((p) => ({ ...p, displayName: e.target.value }));
                }}
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.phoneOptionalLabel')}</span>
              <input
                className="pp-input"
                value={publish.phone}
                onChange={(e) => {
                  markDirty();
                  setPublish((p) => ({ ...p, phone: e.target.value }));
                }}
                placeholder={t('providerPortal.phonePlaceholder')}
              />
            </label>
          </div>
          <label className="pp-field">
            <span className="pp-field__label">{t('providerPortal.addressOptionalLabel')}</span>
            <input
              className="pp-input"
              value={publish.address}
              onChange={(e) => {
                markDirty();
                setPublish((p) => ({ ...p, address: e.target.value }));
              }}
            />
          </label>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.workingHoursLabel')}</span>
              <input
                className="pp-input"
                value={publish.workingHours}
                onChange={(e) => {
                  markDirty();
                  setPublish((p) => ({ ...p, workingHours: e.target.value }));
                }}
                placeholder={t('providerPortal.workingHoursPlaceholder')}
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.breakHoursLabel')}</span>
              <input
                className="pp-input"
                value={publish.breakHours}
                onChange={(e) => {
                  markDirty();
                  setPublish((p) => ({ ...p, breakHours: e.target.value }));
                }}
                placeholder={t('providerPortal.breakHoursPlaceholder')}
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.availableStaffLabel')}</span>
              <input
                className="pp-input"
                type="number"
                min={1}
                value={publish.staffCount}
                onChange={(e) => {
                  markDirty();
                  setPublish((p) => ({ ...p, staffCount: Number(e.target.value) }));
                }}
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.slotIntervalMinutesLabel')}</span>
              <input
                className="pp-input"
                type="number"
                min={5}
                value={publish.slotIntervalMin}
                onChange={(e) => {
                  markDirty();
                  setPublish((p) => ({ ...p, slotIntervalMin: Number(e.target.value) }));
                }}
              />
            </label>
          </div>
          <label className="pp-field pp-field--checkbox">
            <input
              type="checkbox"
              checked={publish.bookingLimitEnabled}
              onChange={(e) => {
                markDirty();
                setPublish((p) => ({ ...p, bookingLimitEnabled: e.target.checked }));
              }}
            />
            <span>{t('providerPortal.capDailyAppointments')}</span>
          </label>
          {publish.bookingLimitEnabled ? (
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.bookingLimitPerDayLabel')}</span>
              <input
                className="pp-input"
                type="number"
                min={1}
                value={publish.bookingLimitPerDay}
                onChange={(e) => {
                  markDirty();
                  setPublish((p) => ({ ...p, bookingLimitPerDay: Number(e.target.value) }));
                }}
              />
            </label>
          ) : null}
          <label className="pp-field">
            <span className="pp-field__label">{t('providerPortal.holidayClosuresLabel')}</span>
            <textarea
              className="pp-input"
              rows={2}
              value={publish.holidayClosures}
              onChange={(e) => {
                markDirty();
                setPublish((p) => ({ ...p, holidayClosures: e.target.value }));
              }}
              placeholder={t('providerPortal.holidayClosuresPlaceholder')}
            />
          </label>
          <button type="submit" className="pp-btn pp-btn--primary" disabled={publishBusy}>
            {publishBusy ? t('providerPortal.saving') : t('providerPortal.saveListing')}
          </button>
        </form>
      </div>

      <div className="pp-providerFormCard" style={{ marginTop: 14 }}>
        <h3 className="pp-providerFormCard__title">{t('providerPortal.visibilityBoostsTitle')}</h3>
        <p className="pp-muted" style={{ marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
          {t('providerPortal.visibilityBoostsDescription')}
        </p>
        <div className="pp-providerBoostToggles">
          <div className="pp-providerBoostToggle">
            <div className="pp-providerBoostToggle__copy">
              <strong>{t('providerPortal.boostNearbyTitle')}</strong>
              <small>{t('providerPortal.boostNearbyDescription')}</small>
            </div>
            <div className="pp-providerBoostToggle__actions">
              <span className="pp-providerBoostToggle__price">{t('providerPortal.boostNearbyPriceShort')}</span>
              <label className={`pp-providerBoostSwitch${nearbyBoostActive ? ' is-on' : ''}`}>
                <input type="checkbox" checked={nearbyBoostActive} readOnly tabIndex={-1} />
                <span aria-hidden />
              </label>
              {!nearbyBoostActive ? (
                <Link className="pp-providerBoostSubscribe" to="/shop?sku=STORE_BOOST_NEARBY_MONTHLY">
                  {t('providerPortal.subscribe')}
                </Link>
              ) : (
                <button
                  type="button"
                  className="pp-btn pp-btn--ghost pp-providerBoostCancel"
                  disabled={boostCancelBusy === 'nearby'}
                  onClick={() => void onCancelBoost('nearby')}
                >
                  {boostCancelBusy === 'nearby' ? t('providerPortal.cancelling') : t('common.cancel')}
                </button>
              )}
            </div>
          </div>
          <div className="pp-providerBoostToggle">
            <div className="pp-providerBoostToggle__copy">
              <strong>{t('providerPortal.boostBookingsTitle')}</strong>
              <small>{t('providerPortal.boostBookingsDescription')}</small>
            </div>
            <div className="pp-providerBoostToggle__actions">
              <span className="pp-providerBoostToggle__price">{t('providerPortal.boostBookingsPriceShort')}</span>
              <label className={`pp-providerBoostSwitch${bookingsBoostActive ? ' is-on' : ''}`}>
                <input type="checkbox" checked={bookingsBoostActive} readOnly tabIndex={-1} />
                <span aria-hidden />
              </label>
              {!bookingsBoostActive ? (
                <Link className="pp-providerBoostSubscribe" to="/shop?sku=STORE_BOOST_BOOKINGS_MONTHLY">
                  {t('providerPortal.subscribe')}
                </Link>
              ) : (
                <button
                  type="button"
                  className="pp-btn pp-btn--ghost pp-providerBoostCancel"
                  disabled={boostCancelBusy === 'bookings'}
                  onClick={() => void onCancelBoost('bookings')}
                >
                  {boostCancelBusy === 'bookings' ? t('providerPortal.cancelling') : t('common.cancel')}
                </button>
              )}
            </div>
          </div>
        </div>
        {boostCancelMsg ? <p className="pp-muted" style={{ marginTop: 10, marginBottom: 0 }}>{boostCancelMsg}</p> : null}
        <Link className="pp-link" to="/shop" style={{ marginTop: 10, display: 'inline-block' }}>
          {t('providerPortal.openPetPalShop')}
        </Link>
      </div>
    </section>
  );
}

function Availability({
  companyId,
  profile,
  publish,
  setPublish,
  publishErr,
  setPublishErr,
  publishBusy,
  setPublishBusy,
  nearbyBoostActive,
  bookingsBoostActive,
  boostCancelBusy,
  boostCancelMsg,
  onCancelBoost,
  openAddPanel = false,
  holidayCountry = 'CY',
  onHolidayCountryChange,
  onSaveHolidayCountry,
  onListingDirty,
  onListingSaved,
}) {
  const { t } = useI18n();
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [computedSlots, setComputedSlots] = useState([]);
  const [useRules, setUseRules] = useState(true);
  const [schedulingSettings, setSchedulingSettings] = useState(null);
  const [err, setErr] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => startOfDay(new Date()));

  useEffect(() => subscribeCompanyServices(companyId, setServices, (e) => setErr(e?.message || t('common.errorGeneric'))), [companyId, t]);
  useEffect(
    () => subscribeCompanyAvailability(companyId, setSlots, (e) => setErr(e?.message || t('common.errorGeneric'))),
    [companyId, t]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await fetchSchedulingSettings(companyId);
        if (cancelled) return;
        setSchedulingSettings({ ...settings, holidayCountry: settings.holidayCountry || holidayCountry });
        setUseRules(settings.useRuleEngine !== false);
        const ctx = await loadSchedulingContext(companyId);
        if (!ctx.rules.length || cancelled) return;
        const rangeStart = new Date();
        const rangeEnd = new Date(rangeStart.getTime() + 60 * 86400000);
        const bookings = await fetchBookingsInRange(companyId, rangeStart, rangeEnd);
        const merged = [];
        for (const svc of services) {
          const rows = computeAvailableSlots({
            settings,
            service: svc,
            serviceId: svc.id,
            rules: ctx.rules,
            overrides: ctx.overrides,
            vacations: ctx.vacations,
            blockedPeriods: ctx.blockedPeriods,
            bookings,
            rangeStart,
            rangeEnd,
          }).map(slotToFirestoreShape);
          merged.push(...rows);
        }
        if (!cancelled) setComputedSlots(merged);
      } catch {
        if (!cancelled) setComputedSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, services, holidayCountry]);

  const byServiceName = useMemo(() => {
    const m = new Map();
    services.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [services]);

  const displaySlots = useRules && computedSlots.length ? computedSlots : slots;

  return (
    <>
      {err ? <div className="pp-error" style={{ marginBottom: 10 }}>{err}</div> : null}
      <AvailabilityScheduler
        companyId={companyId}
        services={services}
        settings={schedulingSettings || { holidayCountry }}
        onSettingsChange={(next) => {
          setSchedulingSettings(next);
          onHolidayCountryChange?.(next.holidayCountry);
          void onSaveHolidayCountry?.(next.holidayCountry);
        }}
      />
      <CalendarAvailabilityPanel
        slots={displaySlots}
        servicesById={byServiceName}
        selectedDate={calendarDate}
        onSelectedDateChange={setCalendarDate}
        initialShowAdd={openAddPanel && !useRules}
        emptyText={useRules ? t('providerPortal.noBookableSlotsOnDate') : t('providerPortal.noAvailabilityYet')}
        onToggleSlot={useRules ? undefined : (s) => setSlotStatus(companyId, s.id, s.status === 'open' ? 'blocked' : 'open')}
        hideAdd={useRules}
      />
      <PublicListingPanel
        companyId={companyId}
        profile={profile}
        publish={publish}
        setPublish={setPublish}
        publishErr={publishErr}
        setPublishErr={setPublishErr}
        publishBusy={publishBusy}
        setPublishBusy={setPublishBusy}
        nearbyBoostActive={nearbyBoostActive}
        bookingsBoostActive={bookingsBoostActive}
        boostCancelBusy={boostCancelBusy}
        boostCancelMsg={boostCancelMsg}
        onCancelBoost={onCancelBoost}
        onListingDirty={onListingDirty}
        onListingSaved={onListingSaved}
      />
    </>
  );
}

function Bookings({ companyId }) {
  const { t, language } = useI18n();
  const locale = language || undefined;
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [legacySlots, setLegacySlots] = useState([]);
  const [useRuleEngine, setUseRuleEngine] = useState(false);
  const [walkInSlots, setWalkInSlots] = useState([]);
  const [swapSlots, setSwapSlots] = useState([]);
  const [services, setServices] = useState([]);
  const [clientPets, setClientPets] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busyId, setBusyId] = useState('');
  const [swapBookingId, setSwapBookingId] = useState('');
  const [swapSlotId, setSwapSlotId] = useState('');
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInDate, setWalkInDate] = useState(() => startOfDay(new Date()));
  const [walkIn, setWalkIn] = useState({
    clientPetId: '',
    petName: '',
    ownerName: '',
    ownerPhone: '',
    serviceId: '',
    slotId: '',
    notes: '',
  });

  useEffect(() => subscribeProviderBookings(companyId, setRows, (e) => setErr(e?.message || t('common.errorGeneric'))), [companyId, t]);
  useEffect(() => subscribeCompanyAvailability(companyId, setLegacySlots, () => {}), [companyId]);
  useEffect(() => subscribeCompanyServices(companyId, setServices, () => {}), [companyId]);
  useEffect(() => subscribeClientPets(companyId, setClientPets, () => {}), [companyId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ctx = await loadSchedulingContext(companyId);
        if (!cancelled) setUseRuleEngine(ctx.rules.length > 0);
      } catch {
        if (!cancelled) setUseRuleEngine(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (!useRuleEngine || !walkIn.serviceId || !walkInDate) {
      setWalkInSlots([]);
      return undefined;
    }
    let cancelled = false;
    const svc = services.find((s) => s.id === walkIn.serviceId);
    void (async () => {
      try {
        const rowsOpen = await fetchOpenSlots(companyId, walkIn.serviceId, {
          after: startOfDay(walkInDate),
          durationMin: svc?.durationMin,
        });
        if (!cancelled) setWalkInSlots(rowsOpen);
      } catch {
        if (!cancelled) setWalkInSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, useRuleEngine, walkIn.serviceId, walkInDate, services]);

  useEffect(() => {
    if (!useRuleEngine || !swapBookingId) {
      setSwapSlots([]);
      return undefined;
    }
    const booking = rows.find((b) => b.id === swapBookingId);
    if (!booking?.serviceId) {
      setSwapSlots([]);
      return undefined;
    }
    let cancelled = false;
    const svc = services.find((s) => s.id === booking.serviceId);
    void (async () => {
      try {
        const rowsOpen = await fetchOpenSlots(companyId, booking.serviceId, {
          after: startOfDay(new Date()),
          durationMin: svc?.durationMin,
        });
        if (!cancelled) setSwapSlots(rowsOpen);
      } catch {
        if (!cancelled) setSwapSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, useRuleEngine, swapBookingId, rows, services]);

  const servicesById = useMemo(() => {
    const m = new Map();
    services.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [services]);

  const activeServices = useMemo(() => services.filter((s) => s.active !== false), [services]);

  const openSlotsForWalkIn = useMemo(() => {
    if (!walkIn.serviceId || !walkInDate) return [];
    const dayKey = dateKey(walkInDate);
    const matchesDay = (s) => {
      const d = slotDate(s);
      return d && dateKey(d) === dayKey;
    };
    if (useRuleEngine) return walkInSlots.filter(matchesDay);
    return legacySlots
      .filter((s) => (s.status || 'open') === 'open' && String(s.serviceId) === String(walkIn.serviceId))
      .filter(matchesDay)
      .sort((a, b) => (slotDate(a)?.getTime() || 0) - (slotDate(b)?.getTime() || 0));
  }, [legacySlots, walkIn.serviceId, walkInDate, useRuleEngine, walkInSlots]);

  useEffect(() => {
    if (!walkIn.serviceId && activeServices.length) {
      setWalkIn((p) => ({ ...p, serviceId: activeServices[0].id }));
    }
  }, [activeServices, walkIn.serviceId]);

  useEffect(() => {
    if (!walkIn.clientPetId) return;
    const pet = clientPets.find((p) => p.id === walkIn.clientPetId);
    if (!pet) return;
    setWalkIn((p) => ({
      ...p,
      petName: pet.name || p.petName,
      ownerName: pet.ownerName || p.ownerName,
      ownerPhone: pet.ownerPhone || p.ownerPhone,
    }));
  }, [walkIn.clientPetId, clientPets]);

  const openSlotsForBooking = useMemo(() => {
    const booking = rows.find((b) => b.id === swapBookingId);
    if (!booking) return [];
    if (useRuleEngine) return swapSlots;
    return legacySlots
      .filter((s) => (s.status || 'open') === 'open' && String(s.serviceId) === String(booking.serviceId))
      .sort((a, b) => (slotDate(a)?.getTime() || 0) - (slotDate(b)?.getTime() || 0));
  }, [rows, legacySlots, swapBookingId, useRuleEngine, swapSlots]);

  const displayedRows = useMemo(() => {
    return rows
      .filter((b) => String(b.status || '').toLowerCase() !== 'cancelled')
      .sort((a, b) => {
        const da = a.startAt?.toDate ? a.startAt.toDate() : a.startAt instanceof Date ? a.startAt : null;
        const db = b.startAt?.toDate ? b.startAt.toDate() : b.startAt instanceof Date ? b.startAt : null;
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      });
  }, [rows]);

  const onSwap = async () => {
    if (!swapBookingId || !swapSlotId) return;
    setErr('');
    setBusyId(swapBookingId);
    try {
      await swapBookingSlot({ companyId, bookingId: swapBookingId, newSlotId: swapSlotId });
      setSwapBookingId('');
      setSwapSlotId('');
    } catch (e) {
      setErr(e?.message || t('common.errorGeneric'));
    } finally {
      setBusyId('');
    }
  };

  const onBookingStatus = async (bookingId, patch) => {
    setErr('');
    setOk('');
    setBusyId(bookingId);
    try {
      await updateBookingStatus(bookingId, patch);
      if (patch.status === 'completed') setOk(t('providerPortal.bookingMarkedComplete'));
      else if (patch.status === 'cancelled') setOk(t('providerPortal.bookingCancelled'));
    } catch (e) {
      setErr(e?.message || t('providerPortal.couldNotUpdateBooking'));
    } finally {
      setBusyId('');
    }
  };

  const onWalkInBook = async (e) => {
    e.preventDefault();
    setErr('');
    setOk('');
    const petName = String(walkIn.petName || '').trim();
    if (!petName) {
      setErr(t('providerPortal.enterPetNameForAppointment'));
      return;
    }
    if (!walkIn.serviceId || !walkIn.slotId || !walkInDate) {
      setErr(t('providerPortal.pickDateServiceAndOpenSlot'));
      return;
    }
    setBusyId('walkin');
    try {
      const service = services.find((s) => s.id === walkIn.serviceId);
      await createProviderBooking({
        companyId,
        providerUid: user?.uid || companyId,
        serviceId: walkIn.serviceId,
        slotId: walkIn.slotId,
        clientPetId: walkIn.clientPetId || null,
        petSnapshot: { name: petName },
        ownerName: walkIn.ownerName,
        ownerPhone: walkIn.ownerPhone,
        serviceSnapshot: service
          ? { name: service.name, durationMin: service.durationMin, type: service.type }
          : null,
        notes: walkIn.notes,
      });
      setOk(t('providerPortal.appointmentBookedForWalkIn'));
      setWalkIn((p) => ({ ...p, slotId: '', notes: '' }));
      setShowWalkIn(false);
    } catch (e2) {
      setErr(e2?.message || t('common.errorGeneric'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="pp-providerPanel">
      <div className="pp-providerPanel__head">
        <div>
          <h2>{t('providerPortal.bookingsTitle')}</h2>
          <p>{t('providerPortal.bookingsDescription')}</p>
        </div>
        <button type="button" className="pp-btn pp-btn--primary" onClick={() => {
          setShowWalkIn((v) => {
            if (!v) setWalkInDate(startOfDay(new Date()));
            return !v;
          });
        }}>
          {showWalkIn ? t('common.cancel') : `+ ${t('providerPortal.bookWalkIn')}`}
        </button>
      </div>

      {showWalkIn ? (
        <div className="pp-providerFormCard" style={{ marginBottom: 14 }}>
          <h3 className="pp-providerFormCard__title">{t('providerPortal.walkInBookingTitle')}</h3>
          <p className="pp-muted" style={{ marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
            {t('providerPortal.walkInBookingDescription')}
          </p>
          <form onSubmit={onWalkInBook} className="pp-form pp-providerForm">
            <div className="pp-field">
              <span className="pp-field__label">{t('providerPortal.dateLabel')}</span>
              <BookingHeatCalendar
                bookings={[]}
                selectedDate={walkInDate}
                onSelectedDateChange={(d) => {
                  setWalkInDate(d);
                  setWalkIn((p) => ({ ...p, slotId: '' }));
                }}
                showHeat={false}
                showLegend={false}
                className="pp-bookingHeatCalendar--walkIn"
              />
            </div>
            {clientPets.length ? (
              <label className="pp-field">
                <span className="pp-field__label">{t('providerPortal.clientOnFileOptional')}</span>
                <select
                  className="pp-input"
                  value={walkIn.clientPetId}
                  onChange={(e) => setWalkIn((p) => ({ ...p, clientPetId: e.target.value }))}
                >
                  <option value="">{t('providerPortal.newManualEntry')}</option>
                  {clientPets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.ownerName ? ` — ${p.ownerName}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="pp-modalGrid2">
              <label className="pp-field">
                <span className="pp-field__label">{t('providerPortal.petNameLabel')}</span>
                <input
                  className="pp-input"
                  value={walkIn.petName}
                  onChange={(e) => setWalkIn((p) => ({ ...p, petName: e.target.value }))}
                  required
                />
              </label>
              <label className="pp-field">
                <span className="pp-field__label">{t('providerPortal.ownerNameLabel')}</span>
                <input
                  className="pp-input"
                  value={walkIn.ownerName}
                  onChange={(e) => setWalkIn((p) => ({ ...p, ownerName: e.target.value }))}
                />
              </label>
              <label className="pp-field">
                <span className="pp-field__label">{t('providerPortal.ownerPhoneLabel')}</span>
                <input
                  className="pp-input"
                  value={walkIn.ownerPhone}
                  onChange={(e) => setWalkIn((p) => ({ ...p, ownerPhone: e.target.value }))}
                />
              </label>
              <label className="pp-field">
                <span className="pp-field__label">{t('providerPortal.serviceFallback')}</span>
                <select
                  className="pp-input"
                  value={walkIn.serviceId}
                  onChange={(e) => setWalkIn((p) => ({ ...p, serviceId: e.target.value, slotId: '' }))}
                >
                  {activeServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="pp-field">
              <span className="pp-field__label">{t('providerPortal.slotFallback')}</span>
              {!walkIn.serviceId ? (
                <p className="pp-muted" style={{ margin: 0 }}>{t('providerPortal.selectServiceFirst')}</p>
              ) : openSlotsForWalkIn.length ? (
                <div className="pp-walkInSlotGrid" role="listbox" aria-label={t('providerPortal.availableTimeSlotsAriaLabel')}>
                  {openSlotsForWalkIn.map((s) => {
                    const d = slotDate(s);
                    const isSelected = walkIn.slotId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`pp-walkInSlotBtn ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setWalkIn((p) => ({ ...p, slotId: s.id }))}
                      >
                        {d ? formatTime24(d) : s.id}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="pp-muted" style={{ margin: 0 }}>
                  {t('providerPortal.noOpenSlotsOnDate', {
                    date: walkInDate.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' }),
                  })}
                </p>
              )}
            </div>
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.notesOptionalLabel')}</span>
              <textarea
                className="pp-input"
                rows={2}
                value={walkIn.notes}
                onChange={(e) => setWalkIn((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>
            <button className="pp-btn pp-btn--primary" type="submit" disabled={busyId === 'walkin' || !activeServices.length || !walkIn.slotId}>
              {busyId === 'walkin' ? t('providerPortal.bookingInProgress') : t('providerPortal.confirmBooking')}
            </button>
          </form>
        </div>
      ) : null}

      {err ? <div className="pp-error">{err}</div> : null}
      {ok ? <div className="pp-success">{ok}</div> : null}
      {displayedRows.length === 0 ? (
        <div className="pp-providerEmptyCard">
          {t('providerPortal.noBookingsYet')}
        </div>
      ) : null}
      <div className="pp-bookingDetailList" style={{ marginTop: displayedRows.length ? 10 : 0 }}>
        {displayedRows.map((b) => {
          const serviceName = b.serviceSnapshot?.name || servicesById.get(b.serviceId) || t('providerPortal.serviceFallback');
          const isSwapping = swapBookingId === b.id;
          return (
            <div key={b.id} className="pp-bookingDetailList__item">
              <ProviderBookingCard
                booking={b}
                serviceName={serviceName}
                busy={busyId === b.id}
                onComplete={(id) => void onBookingStatus(id, { status: 'completed' })}
                onCancel={(id) => void onBookingStatus(id, { status: 'cancelled' })}
              />
              {b.status === 'booked' ? (
                <div className="pp-bookingDetailList__extra">
                  <button
                    type="button"
                    className="pp-btn pp-btn--ghost"
                    onClick={() => {
                      setSwapBookingId(isSwapping ? '' : b.id);
                      setSwapSlotId('');
                    }}
                  >
                    {isSwapping ? t('providerPortal.closeReschedule') : t('providerPortal.reschedule')}
                  </button>
                </div>
              ) : null}
              {isSwapping ? (
                <div className="pp-providerSwapRow">
                  <select className="pp-input" value={swapSlotId} onChange={(e) => setSwapSlotId(e.target.value)}>
                    <option value="">{t('providerPortal.pickNewTime')}</option>
                    {openSlotsForBooking.map((s) => {
                      const d = slotDate(s);
                      return (
                        <option key={s.id} value={s.id}>
                          {d ? formatDateTime24(d) : s.id}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    className="pp-btn pp-btn--primary"
                    disabled={!swapSlotId || busyId === b.id}
                    onClick={() => void onSwap()}
                  >
                    {busyId === b.id ? t('providerPortal.saving') : t('providerPortal.confirmSwap')}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Customers({ companyId, clinicLabel = '' }) {
  const { t } = useI18n();
  const [bookings, setBookings] = useState([]);
  const [clientPets, setClientPets] = useState([]);
  const [err, setErr] = useState('');
  const [medClient, setMedClient] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [form, setForm] = useState({ name: '', ownerName: '', ownerPhone: '', trackingImei: '' });

  useEffect(() => subscribeProviderBookings(companyId, setBookings, (e) => setErr(e?.message || t('common.errorGeneric'))), [companyId, t]);
  useEffect(() => subscribeClientPets(companyId, setClientPets, (e) => setErr(e?.message || t('common.errorGeneric'))), [companyId, t]);

  const customersFromBookings = useMemo(() => {
    const map = new Map();
    bookings.forEach((b) => {
      const key = String(b.customerUid || b.petSnapshot?.name || b.id);
      const row = map.get(key) || {
        key,
        petName: b.petSnapshot?.name || t('providerPortal.petFallback'),
        ownerLabel: b.customerUid
          ? t('providerPortal.customerLabelWithId', { id: String(b.customerUid).slice(0, 8) })
          : t('providerPortal.walkInCustomer'),
        visits: 0,
        lastVisit: '',
      };
      row.visits += 1;
      const when = b.startAt?.toDate ? b.startAt.toDate().toISOString() : '';
      if (when && when > row.lastVisit) row.lastVisit = when;
      map.set(key, row);
    });
    return [...map.values()].sort((a, b) => String(b.lastVisit).localeCompare(String(a.lastVisit)));
  }, [bookings, t]);

  const onCreatePet = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await createClientPet(companyId, form);
      setForm({ name: '', ownerName: '', ownerPhone: '', trackingImei: '' });
    } catch (e2) {
      setErr(e2?.message || t('common.errorGeneric'));
    }
  };

  return (
    <>
      {medClient ? (
        <PetMedicationModal
          key={medClient.id}
          open
          onClose={() => setMedClient(null)}
          mode="vet"
          petName={String(medClient.name || '')}
          vetClinicLabel={clinicLabel}
          initialVetRows={Array.isArray(medClient.medications) ? medClient.medications : []}
          onSaveVet={async (nextRows) => {
            const medications = nextRows.map((r) => {
              const times = Array.isArray(r.times) && r.times.length
                ? r.times.map((t) => String(t).slice(0, 5))
                : [String(r.time || '09:00').slice(0, 5)];
              const pillCount = Math.max(1, Number(r.pillCount) || 1);
              return {
                id: String(r.id),
                name: String(r.name || ''),
                times,
                time: times[0],
                pillCount,
                dosage: String(r.dosage || ''),
                notes: String(r.notes || ''),
                source: r.source === 'owner' ? 'owner' : 'vet',
                vetLabel: String(r.vetLabel || ''),
              };
            });
            await patchClientPet(companyId, String(medClient.id), { medications });
          }}
        />
      ) : null}
      <section className="pp-providerPanel">
        <div className="pp-providerPanel__head">
          <div>
            <h2>{t('providerPortal.customersTitle')}</h2>
            <p>{t('providerPortal.customersDescription')}</p>
          </div>
        </div>

        {err ? <div className="pp-error" style={{ marginBottom: 10 }}>{err}</div> : null}

        <div className="pp-providerFormCard">
          <h3 className="pp-providerFormCard__title">{t('providerPortal.addClientPetTitle')}</h3>
          <p className="pp-muted" style={{ marginTop: 0, marginBottom: 12 }}>
            {t('providerPortal.addClientPetDescription')}
          </p>
          <form onSubmit={onCreatePet} className="pp-form pp-providerForm">
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.petNameLabel')}</span>
              <input className="pp-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t('providerPortal.petNamePlaceholder')} required />
            </label>
            <div className="pp-modalGrid2">
              <label className="pp-field">
                <span className="pp-field__label">{t('providerPortal.ownerNameLabel')}</span>
                <input className="pp-input" value={form.ownerName} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))} placeholder={t('providerPortal.ownerNamePlaceholder')} />
              </label>
              <label className="pp-field">
                <span className="pp-field__label">{t('providerPortal.ownerPhoneLabel')}</span>
                <input className="pp-input" type="tel" value={form.ownerPhone} onChange={(e) => setForm((p) => ({ ...p, ownerPhone: e.target.value }))} placeholder={t('providerPortal.ownerPhonePlaceholder')} />
              </label>
            </div>
            <label className="pp-field">
              <span className="pp-field__label">{t('providerPortal.trackerImeiOptional')}</span>
              <input className="pp-input" value={form.trackingImei} onChange={(e) => setForm((p) => ({ ...p, trackingImei: e.target.value }))} placeholder={t('providerPortal.trackerImeiPlaceholder')} />
            </label>
            <button className="pp-btn pp-btn--primary" type="submit">{t('providerPortal.addPet')}</button>
          </form>
        </div>

        <div className="pp-providerClientGrid" style={{ marginTop: 14 }}>
          <h3 className="pp-providerFormCard__title" style={{ gridColumn: '1 / -1', margin: 0 }}>{t('providerPortal.customersFromBookingsTitle')}</h3>
          {customersFromBookings.length === 0 ? (
            <div className="pp-providerEmptyCard" style={{ gridColumn: '1 / -1' }}>{t('providerPortal.noCustomersFromBookings')}</div>
          ) : (
            customersFromBookings.map((c) => (
              <article key={c.key} className="pp-providerClientCard">
                <div className="pp-providerAvatar" aria-hidden>{c.petName.charAt(0)}</div>
                <div>
                  <h3>{c.petName}</h3>
                  <p>{c.ownerLabel}</p>
                  <small>{visitCountLabel(t, c.visits)}{c.lastVisit ? ` · ${formatDateTime24(new Date(c.lastVisit))}` : ''}</small>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="pp-providerClientGrid" style={{ marginTop: 14 }}>
          <h3 className="pp-providerFormCard__title" style={{ gridColumn: '1 / -1', margin: 0 }}>{t('providerPortal.clientPetsOnFileTitle')}</h3>
          {clientPets.length === 0 ? (
            <div className="pp-providerEmptyCard" style={{ gridColumn: '1 / -1' }}>{t('providerPortal.noPetsAddedYet')}</div>
          ) : (
            clientPets.map((p) => (
              <article key={p.id} className="pp-providerClientCard">
                <div className="pp-providerAvatar" aria-hidden>{p.name.charAt(0)}</div>
                <div>
                  <h3>{p.name}</h3>
                  <p>{p.ownerName || t('providerPortal.walkInCustomer')}</p>
                  <small>{p.ownerPhone || t('providerPortal.noPhone')}{p.trackingImei ? ` · ${t('providerPortal.trackerLinked')}` : ''}</small>
                </div>
                <div className="pp-providerClientCard__actions">
                  {p.ownerPhone ? (
                    <a href={`tel:${p.ownerPhone}`} className="pp-btn pp-btn--ghost">{t('providerPortal.call')}</a>
                  ) : null}
                  <button type="button" className="pp-btn pp-iconBtn pp-iconBtn--outline" aria-label={t('providerPortal.medication')} onClick={() => setMedClient(p)}>
                    <IconMedPill size={16} />
                  </button>
                  <button type="button" className="pp-btn pp-btn--ghost" onClick={() => deleteClientPet(companyId, p.id)}>{t('providerPortal.remove')}</button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}


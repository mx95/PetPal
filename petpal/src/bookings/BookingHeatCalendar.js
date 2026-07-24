import React, { useMemo, useState } from 'react';
import {
  BookingHeatLegend,
  bookingHeatStyles,
  bookingHeatStylesFromMax,
  dateKey,
  groupBookingsByDay,
  maxBookingsInPeriod,
  monthDays,
  startOfDay,
} from './bookingHeatMap';
import { useI18n } from '../i18n/I18nContext';

const WEEKDAY_KEYS_MON_START = [
  'weekdayMonNarrow',
  'weekdayTueNarrow',
  'weekdayWedNarrow',
  'weekdayThuNarrow',
  'weekdayFriNarrow',
  'weekdaySatNarrow',
  'weekdaySunNarrow',
];

/**
 * Month calendar with optional green → red booking density heat.
 */
export default function BookingHeatCalendar({
  bookings = [],
  dayCapacityByKey = null,
  selectedDate: controlledSelectedDate,
  onSelectedDateChange,
  legendLabels = null,
  showLegend = true,
  showHeat = true,
  monthOnly = true,
  className = '',
}) {
  const { t, language } = useI18n();
  const [internalSelectedDate, setInternalSelectedDate] = useState(() => startOfDay(new Date()));
  const selectedDate = controlledSelectedDate ?? internalSelectedDate;
  const setSelectedDate = (day) => {
    const d = startOfDay(day);
    if (onSelectedDateChange) onSelectedDateChange(d);
    else setInternalSelectedDate(d);
  };

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = controlledSelectedDate ?? internalSelectedDate;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const bookingsByDay = useMemo(() => groupBookingsByDay(bookings), [bookings]);
  const monthGrid = useMemo(() => monthDays(visibleMonth), [visibleMonth]);
  const selectedKey = dateKey(selectedDate);

  const maxHeat = useMemo(
    () =>
      maxBookingsInPeriod(bookingsByDay, {
        view: 'month',
        monthGrid,
        visibleMonth,
        weekRow: [],
        selectedKey,
      }),
    [bookingsByDay, monthGrid, visibleMonth, selectedKey]
  );

  const hasCapacityHeat = Boolean(dayCapacityByKey && dayCapacityByKey.size > 0);
  const showHeatLegend = showLegend && showHeat && (hasCapacityHeat || maxHeat > 0);

  const monthLabel = visibleMonth.toLocaleDateString(language, { month: 'long', year: 'numeric' });
  const weekdayLabels = useMemo(
    () => WEEKDAY_KEYS_MON_START.map((key) => t(`availability.${key}`)),
    [t]
  );

  const selectDate = (day) => {
    setSelectedDate(day);
    setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  const renderDayButton = (day, { inMonth = true } = {}) => {
    const key = dateKey(day);
    const dayBookings = bookingsByDay.get(key) || [];
    const isSelected = key === selectedKey;
    const isToday = key === dateKey(new Date());
    const capacity = hasCapacityHeat ? dayCapacityByKey.get(key) || 0 : 0;
    const heatStyle =
      showHeat && !isSelected
        ? hasCapacityHeat
          ? bookingHeatStyles(dayBookings.length, capacity)
          : bookingHeatStylesFromMax(dayBookings.length, maxHeat)
        : undefined;

    const titleParts = [];
    if (dayBookings.length) {
      titleParts.push(
        t(dayBookings.length === 1 ? 'bookingsHub.bookingCountOne' : 'bookingsHub.bookingCountOther', {
          count: dayBookings.length,
        })
      );
    }
    if (hasCapacityHeat && capacity > 0) titleParts.push(t('bookingsHub.slotsAvailable', { count: capacity }));

    return (
      <button
        key={key}
        type="button"
        className={`${isSelected ? 'is-selected' : ''} ${!inMonth ? 'is-muted' : ''} ${dayBookings.length ? 'has-slots has-bookings' : ''} ${hasCapacityHeat && capacity > 0 ? 'has-capacity' : ''} ${isToday ? 'is-today' : ''}`}
        style={heatStyle}
        title={titleParts.length ? titleParts.join(' · ') : undefined}
        onClick={() => selectDate(day)}
      >
        <span>{day.getDate()}</span>
        {dayBookings.length ? <em>{Math.min(dayBookings.length, 9)}</em> : null}
      </button>
    );
  };

  return (
    <div className={`pp-providerCalendarCard pp-bookingHeatCalendar ${monthOnly ? 'pp-bookingHeatCalendar--monthOnly' : ''} ${className}`.trim()}>
      <div className="pp-providerCalendarMobileMonth" aria-live="polite">
        <div className="pp-providerCalendarMobileNav">
          <button type="button" aria-label={t('providerPortal.previousMonth')} onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            ‹
          </button>
          <strong>{monthLabel}</strong>
          <button type="button" aria-label={t('providerPortal.nextMonth')} onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            ›
          </button>
        </div>
      </div>

      <div className="pp-providerCalendarCard__top pp-providerCalendarCard__top--desktop">
        <button type="button" aria-label={t('providerPortal.previousMonth')} onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
          ‹
        </button>
        <strong>{monthLabel}</strong>
        <button type="button" aria-label={t('providerPortal.nextMonth')} onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
          ›
        </button>
      </div>

      <div className="pp-providerCalendarWeek pp-providerCalendarWeek--desktop">
        {weekdayLabels.map((d, idx) => (
          <span key={`${d}-${idx}`}>{d}</span>
        ))}
      </div>

      <div className="pp-providerCalendarGrid pp-providerCalendarGrid--desktopMonth">
        {monthGrid.map((day) => renderDayButton(day, { inMonth: day.getMonth() === visibleMonth.getMonth() }))}
      </div>

      {showHeatLegend ? (
        <BookingHeatLegend
          fewerLabel={legendLabels?.fewer || t('businessWeek.bookingHeatFewer')}
          moreLabel={legendLabels?.more || t('businessWeek.bookingHeatMore')}
        />
      ) : null}
    </div>
  );
}

export { groupBookingsByDay, dateKey, startOfDay } from './bookingHeatMap';

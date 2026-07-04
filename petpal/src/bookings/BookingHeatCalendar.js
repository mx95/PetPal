import React, { useMemo, useState } from 'react';
import {
  BookingHeatLegend,
  bookingHeatStyles,
  dateKey,
  groupBookingsByDay,
  maxBookingsInPeriod,
  monthDays,
  startOfDay,
} from './bookingHeatMap';

/**
 * Month calendar with optional green → red booking density heat.
 */
export default function BookingHeatCalendar({
  bookings = [],
  selectedDate: controlledSelectedDate,
  onSelectedDateChange,
  legendLabels = { fewer: 'Fewer', more: 'More' },
  showLegend = true,
  showHeat = true,
  monthOnly = true,
  className = '',
}) {
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

  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const selectDate = (day) => {
    setSelectedDate(day);
    setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  const renderDayButton = (day, { inMonth = true } = {}) => {
    const key = dateKey(day);
    const dayBookings = bookingsByDay.get(key) || [];
    const isSelected = key === selectedKey;
    const isToday = key === dateKey(new Date());
    const heatStyle =
      showHeat && !isSelected ? bookingHeatStyles(dayBookings.length, maxHeat) : undefined;

    return (
      <button
        key={key}
        type="button"
        className={`${isSelected ? 'is-selected' : ''} ${!inMonth ? 'is-muted' : ''} ${dayBookings.length ? 'has-slots has-bookings' : ''} ${isToday ? 'is-today' : ''}`}
        style={heatStyle}
        title={dayBookings.length ? `${dayBookings.length} booking${dayBookings.length === 1 ? '' : 's'}` : undefined}
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
          <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            ‹
          </button>
          <strong>{monthLabel}</strong>
          <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            ›
          </button>
        </div>
      </div>

      <div className="pp-providerCalendarCard__top pp-providerCalendarCard__top--desktop">
        <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
          ‹
        </button>
        <strong>{monthLabel}</strong>
        <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
          ›
        </button>
      </div>

      <div className="pp-providerCalendarWeek pp-providerCalendarWeek--desktop">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
          <span key={`${d}-${idx}`}>{d}</span>
        ))}
      </div>

      <div className="pp-providerCalendarGrid pp-providerCalendarGrid--desktopMonth">
        {monthGrid.map((day) => renderDayButton(day, { inMonth: day.getMonth() === visibleMonth.getMonth() }))}
      </div>

      {showLegend && showHeat && maxHeat > 0 ? (
        <BookingHeatLegend fewerLabel={legendLabels.fewer} moreLabel={legendLabels.more} />
      ) : null}
    </div>
  );
}

export { groupBookingsByDay, dateKey, startOfDay } from './bookingHeatMap';

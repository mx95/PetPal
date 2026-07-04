import React, { useMemo, useState } from 'react';
import {
  BookingHeatLegend,
  bookingHeatStyles,
  dateKey,
  groupBookingsByDay,
  maxBookingsInPeriod,
  monthDays,
  startOfDay,
  weekDays,
} from './bookingHeatMap';

/**
 * Reusable month/week calendar with green → red booking density heat.
 */
export default function BookingHeatCalendar({
  bookings = [],
  selectedDate: controlledSelectedDate,
  onSelectedDateChange,
  initialView = 'week',
  legendLabels = { fewer: 'Fewer', more: 'More' },
  showLegend = true,
  className = '',
}) {
  const [internalSelectedDate, setInternalSelectedDate] = useState(() => startOfDay(new Date()));
  const selectedDate = controlledSelectedDate ?? internalSelectedDate;
  const setSelectedDate = (day) => {
    const d = startOfDay(day);
    if (onSelectedDateChange) onSelectedDateChange(d);
    else setInternalSelectedDate(d);
  };

  const [view, setView] = useState(initialView);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const bookingsByDay = useMemo(() => groupBookingsByDay(bookings), [bookings]);
  const weekRow = useMemo(() => weekDays(selectedDate), [selectedDate]);
  const monthGrid = useMemo(() => monthDays(visibleMonth), [visibleMonth]);
  const selectedKey = dateKey(selectedDate);

  const maxHeat = useMemo(
    () =>
      maxBookingsInPeriod(bookingsByDay, {
        view,
        monthGrid,
        visibleMonth,
        weekRow,
        selectedKey,
      }),
    [bookingsByDay, view, monthGrid, visibleMonth, weekRow, selectedKey]
  );

  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const mobileMonthLabel = selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const calendarDays = view === 'month' ? monthGrid : weekRow;
  const mobileWeekDays = weekRow;

  const goToday = () => {
    const today = startOfDay(new Date());
    setView('week');
    setSelectedDate(today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const selectDate = (day) => {
    setSelectedDate(day);
    setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  const renderDayButton = (day, { inMonth = true, compact = false } = {}) => {
    const key = dateKey(day);
    const dayBookings = bookingsByDay.get(key) || [];
    const isSelected = key === selectedKey;
    const isToday = key === dateKey(new Date());
    const heatStyle = !isSelected ? bookingHeatStyles(dayBookings.length, maxHeat) : undefined;
    const muted = !inMonth && view === 'month' && !compact;

    return (
      <button
        key={key}
        type="button"
        className={`${isSelected ? 'is-selected' : ''} ${muted ? 'is-muted' : ''} ${dayBookings.length ? 'has-slots has-bookings' : ''} ${isToday ? 'is-today' : ''}`}
        style={heatStyle}
        title={dayBookings.length ? `${dayBookings.length} booking${dayBookings.length === 1 ? '' : 's'}` : undefined}
        onClick={() => selectDate(day)}
      >
        {compact ? (
          <>
            <small>{day.toLocaleDateString(undefined, { weekday: 'short' })}</small>
            <strong>{day.getDate()}</strong>
          </>
        ) : (
          <>
            <span>{day.getDate()}</span>
            {dayBookings.length ? <em>{Math.min(dayBookings.length, 9)}</em> : null}
          </>
        )}
      </button>
    );
  };

  return (
    <div className={`pp-providerCalendarCard pp-bookingHeatCalendar ${className}`.trim()}>
      <div className="pp-providerCalendarControls" style={{ marginBottom: 10 }}>
        <div className="pp-providerCalendarToggle" aria-label="Calendar view">
          <button type="button" className={view === 'month' ? 'is-active' : ''} onClick={() => setView('month')}>
            Month
          </button>
          <button type="button" className={view === 'week' ? 'is-active' : ''} onClick={() => setView('week')}>
            Week
          </button>
          <button type="button" className="" onClick={goToday}>
            Today
          </button>
        </div>
      </div>

      <div className="pp-providerCalendarMobileMonth" aria-live="polite">
        {view === 'month' ? (
          <div className="pp-providerCalendarMobileNav">
            <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              ‹
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              ›
            </button>
          </div>
        ) : (
          <strong>{mobileMonthLabel}</strong>
        )}
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

      {view === 'month' ? (
        <div className="pp-providerCalendarWeek pp-providerCalendarWeek--desktop">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
            <span key={`${d}-${idx}`}>{d}</span>
          ))}
        </div>
      ) : (
        <div className="pp-providerCalendarWeek pp-providerCalendarWeek--mobile">
          {mobileWeekDays.map((day) => (
            <span key={`head-${dateKey(day)}`}>{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
          ))}
        </div>
      )}

      <div className={`pp-providerCalendarGrid pp-providerCalendarGrid--desktopMonth ${view === 'week' ? 'is-week' : ''}`}>
        {calendarDays.map((day) =>
          renderDayButton(day, { inMonth: view !== 'month' || day.getMonth() === visibleMonth.getMonth() })
        )}
      </div>

      <div className="pp-providerCalendarGrid is-week pp-providerCalendarGrid--mobileWeek">
        {mobileWeekDays.map((day) => renderDayButton(day, { compact: true }))}
      </div>

      {showLegend && maxHeat > 0 ? (
        <BookingHeatLegend fewerLabel={legendLabels.fewer} moreLabel={legendLabels.more} />
      ) : null}
    </div>
  );
}

export { groupBookingsByDay, dateKey, startOfDay } from './bookingHeatMap';

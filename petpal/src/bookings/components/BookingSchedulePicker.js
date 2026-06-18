import React, { useMemo } from 'react';
import { formatTime24 } from '../../formatTime24';

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

function slotAt(slot, key) {
  const v = slot?.[key];
  if (v?.toDate) return v.toDate();
  if (slot?.[`${key}Iso`]) return new Date(slot[`${key}Iso`]);
  return null;
}

function slotPeriod(slot) {
  const start = slotAt(slot, 'startAt');
  const h = start ? start.getHours() : 12;
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

/**
 * Calendar + grouped time-slot picker (legacy booking modal design).
 */
export function BookingSchedulePicker({
  dayKey,
  onDayKeyChange,
  monthDate,
  onMonthDateChange,
  slots,
  slotId,
  onSlotIdChange,
  durationMin = 30,
  loading = false,
  error = '',
  isClosedDay = () => false,
  t,
}) {
  const monthDays = useMemo(
    () =>
      monthGrid(monthDate).map((d) => ({
        ...d,
        isClosed: isClosedDay(d.date),
      })),
    [monthDate, isClosedDay]
  );
  const dowLabels = useMemo(() => calendarDowLabels(), []);
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const uniqueSlots = useMemo(() => {
    const seen = new Set();
    return slots.filter((sl) => {
      const start = slotAt(sl, 'startAt');
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

  return (
    <div className="pp-bookSchedulePick">
      <div className="pp-book-field pp-book-calendar">
        <div className="pp-book-calendar__head">
          <span className="pp-book-field__label">{t('bookingsHub.modalPickDate')}</span>
          <div className="pp-book-calendar__monthControls" aria-label="Change month">
            <button type="button" onClick={() => onMonthDateChange(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>
              ‹
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" onClick={() => onMonthDateChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>
              ›
            </button>
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
                  onDayKeyChange(d.key);
                  onMonthDateChange(new Date(d.date.getFullYear(), d.date.getMonth(), 1));
                  onSlotIdChange('');
                }}
                disabled={d.isPast || d.isClosed}
                aria-label={
                  d.isClosed ? t('bookingsHub.modalClosedDay', { date: d.date.toLocaleDateString() }) : undefined
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
        <p className="pp-book-muted pp-book-muted--sm pp-bookSchedulePick__duration">
          {t('bookConfirm.mins', { n: durationMin })}
        </p>
        {loading ? <p className="pp-book-muted">{t('bookingsHub.modalLoadingSlots')}</p> : null}
        {error ? <p className="pp-book-error">{error}</p> : null}
        {!loading && !error && !uniqueSlots.length ? (
          <p className="pp-book-muted">{t('bookConfirm.noSlots')}</p>
        ) : null}
        {['Morning', 'Afternoon', 'Evening'].map((period) =>
          groupedSlots[period]?.length ? (
            <div key={period} className="pp-book-slotPeriod">
              <div className="pp-book-slotPeriod__title">{period}</div>
              <div className="pp-book-slotGrid pp-book-slotGrid--premium">
                {groupedSlots[period].map((sl) => {
                  const active = sl.id === slotId;
                  const startDate = slotAt(sl, 'startAt');
                  const endDate = slotAt(sl, 'endAt');
                  return (
                    <button
                      key={sl.id}
                      type="button"
                      className={`pp-book-slot pp-book-slot--rich${active ? ' is-active' : ''}`}
                      onClick={() => onSlotIdChange(sl.id)}
                    >
                      <strong>{startDate ? formatTime24(startDate) : sl.id}</strong>
                      <span>{durationMin} mins</span>
                      <small>{endDate ? `Ends ${formatTime24(endDate)}` : t('bookConfirm.slotEndTbd')}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

export { toYmd as scheduleToYmd };

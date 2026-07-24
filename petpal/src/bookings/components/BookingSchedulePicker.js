import React, { useMemo } from 'react';
import { formatTime24 } from '../../formatTime24';
import { slotStartDate } from '../slotTime';
import { useI18n } from '../../i18n/I18nContext';

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

function calendarDowLabels(language) {
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) =>
    addDays(monday, i).toLocaleDateString(language, { weekday: 'narrow' })
  );
}

function slotStartMs(slot) {
  const d = slotStartDate(slot);
  return d ? d.getTime() : 0;
}

/**
 * Calendar + flat time-slot picker.
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
}) {
  const { t, language } = useI18n();
  const monthDays = useMemo(
    () =>
      monthGrid(monthDate).map((d) => ({
        ...d,
        isClosed: isClosedDay(d.date),
      })),
    [monthDate, isClosedDay]
  );
  const dowLabels = useMemo(() => calendarDowLabels(language), [language]);
  const monthLabel = monthDate.toLocaleDateString(language, { month: 'long', year: 'numeric' });

  const uniqueSlots = useMemo(() => {
    const seen = new Set();
    return slots.filter((sl) => {
      const start = slotStartDate(sl);
      if (!start) return false;
      const key = start.toISOString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [slots]);

  const sortedSlots = useMemo(
    () => [...uniqueSlots].sort((a, b) => slotStartMs(a) - slotStartMs(b)),
    [uniqueSlots]
  );

  return (
    <div className="pp-bookSchedulePick pp-bookSchedulePick--compact">
      <div className="pp-book-field pp-book-calendar">
        <div className="pp-book-calendar__head">
          <span className="pp-book-field__label">{t('bookingsHub.modalPickDate')}</span>
          <div className="pp-book-calendar__monthControls" aria-label={t('bookingsHub.changeMonth')}>
            <button type="button" aria-label={t('providerPortal.previousMonth')} onClick={() => onMonthDateChange(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>
              ‹
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" aria-label={t('providerPortal.nextMonth')} onClick={() => onMonthDateChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>
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
                  d.isClosed ? t('bookingsHub.modalClosedDay', { date: d.date.toLocaleDateString(language) }) : undefined
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
        {!loading && !error && !sortedSlots.length ? (
          <p className="pp-book-muted">{t('bookConfirm.noSlots')}</p>
        ) : null}
        {sortedSlots.length ? (
          <div className="pp-book-slotGrid pp-book-slotGrid--premium pp-book-slotGrid--uniform">
            {sortedSlots.map((sl) => {
              const active = sl.id === slotId;
              const startDate = slotStartDate(sl);
              if (!startDate) return null;
              return (
                <button
                  key={sl.id}
                  type="button"
                  className={`pp-book-slot pp-book-slot--rich${active ? ' is-active' : ''}`}
                  onClick={() => onSlotIdChange(sl.id)}
                >
                  <strong>{formatTime24(startDate)}</strong>
                  <span>{t('bookConfirm.mins', { n: durationMin })}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { toYmd as scheduleToYmd };

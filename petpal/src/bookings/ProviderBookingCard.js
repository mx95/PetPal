import React from 'react';
import { formatDateTime24 } from '../formatTime24';
import TimeRangeRow from '../components/TimeRangeRow';
import { useI18n } from '../i18n/I18nContext';
import {
  bookingEndDate,
  bookingStartDate,
  bookingStatusLabel,
  formatBookingTimeRange,
  isBookingActionable,
} from './bookingTime';

/**
 * Compact booking row for Schedule tab and provider hub.
 */
export default function ProviderBookingCard({
  booking,
  serviceName = '',
  busy = false,
  onComplete,
  onCancel,
  showActions = true,
}) {
  const { t } = useI18n();
  const start = bookingStartDate(booking);
  const end = bookingEndDate(booking);
  const { startLabel, endLabel } = formatBookingTimeRange(start, end);
  const status = String(booking?.status || 'booked').toLowerCase();
  const actionable = isBookingActionable(status);
  const displayServiceName = serviceName || t('providerPortal.serviceFallback');
  const petName = booking?.petSnapshot?.name || t('providerPortal.petFallback');
  const ownerBits = [booking?.petSnapshot?.ownerName, booking?.petSnapshot?.ownerPhone].filter(Boolean);

  return (
    <article className="pp-bookingDetailCard">
      <div className="pp-bookingDetailCard__top">
        <div className="pp-bookingDetailCard__titleRow">
          <strong className="pp-bookingDetailCard__pet">{petName}</strong>
          {booking?.walkIn ? <span className="pp-bookingDetailCard__pill">{t('providerPortal.walkInLabel')}</span> : null}
          <span className={`pp-bookingDetailCard__status pp-bookingDetailCard__status--${status}`}>
            {bookingStatusLabel(status, t)}
          </span>
        </div>
        <div className="pp-bookingDetailCard__service">{displayServiceName}</div>
        {ownerBits.length ? (
          <div className="pp-bookingDetailCard__owner">{ownerBits.join(' · ')}</div>
        ) : null}
        {start ? (
          <div className="pp-bookingDetailCard__when">{formatDateTime24(start)}</div>
        ) : null}
      </div>

      <TimeRangeRow
        readOnly
        startTime={startLabel}
        endTime={endLabel}
        className="pp-timeRangeRow--booking"
      />

      {showActions && actionable ? (
        <div className="pp-bookingDetailCard__actions">
          {onComplete ? (
            <button
              type="button"
              className="pp-btn pp-btn--ghost"
              disabled={busy}
              onClick={() => onComplete(booking.id)}
            >
              {busy ? t('providerPortal.saving') : t('providerPortal.complete')}
            </button>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              className="pp-btn pp-btn--ghost"
              disabled={busy}
              onClick={() => onCancel(booking.id)}
            >
              {t('common.cancel')}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

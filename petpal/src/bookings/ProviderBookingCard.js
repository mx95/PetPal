import React from 'react';
import { formatDateTime24 } from '../formatTime24';
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
  serviceName = 'Service',
  busy = false,
  onComplete,
  onCancel,
  showActions = true,
}) {
  const start = bookingStartDate(booking);
  const end = bookingEndDate(booking);
  const { startLabel, endLabel } = formatBookingTimeRange(start, end);
  const status = String(booking?.status || 'booked').toLowerCase();
  const actionable = isBookingActionable(status);
  const petName = booking?.petSnapshot?.name || 'Pet';
  const ownerBits = [booking?.petSnapshot?.ownerName, booking?.petSnapshot?.ownerPhone].filter(Boolean);

  return (
    <article className="pp-bookingDetailCard">
      <div className="pp-bookingDetailCard__top">
        <div className="pp-bookingDetailCard__titleRow">
          <strong className="pp-bookingDetailCard__pet">{petName}</strong>
          {booking?.walkIn ? <span className="pp-bookingDetailCard__pill">Walk-in</span> : null}
          <span className={`pp-bookingDetailCard__status pp-bookingDetailCard__status--${status}`}>
            {bookingStatusLabel(status)}
          </span>
        </div>
        <div className="pp-bookingDetailCard__service">{serviceName}</div>
        {ownerBits.length ? (
          <div className="pp-bookingDetailCard__owner">{ownerBits.join(' · ')}</div>
        ) : null}
        {start ? (
          <div className="pp-bookingDetailCard__when">{formatDateTime24(start)}</div>
        ) : null}
      </div>

      <div className="pp-bookingDetailCard__timeRow" aria-label="Appointment time">
        <span className="pp-bookingDetailCard__timeLabel">From</span>
        <strong className="pp-bookingDetailCard__timeValue">{startLabel}</strong>
        <span className="pp-bookingDetailCard__timeArrow" aria-hidden>
          →
        </span>
        <strong className="pp-bookingDetailCard__timeValue">{endLabel}</strong>
        <span className="pp-bookingDetailCard__timeLabel">To</span>
      </div>

      {showActions && actionable ? (
        <div className="pp-bookingDetailCard__actions">
          {onComplete ? (
            <button
              type="button"
              className="pp-btn pp-btn--ghost"
              disabled={busy}
              onClick={() => onComplete(booking.id)}
            >
              {busy ? 'Saving…' : 'Complete'}
            </button>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              className="pp-btn pp-btn--ghost"
              disabled={busy}
              onClick={() => onCancel(booking.id)}
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

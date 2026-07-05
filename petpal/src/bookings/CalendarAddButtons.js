import React, { useMemo } from 'react';
import {
  buildCalendarEvent,
  downloadAppleCalendar,
  hasCalendarTimes,
  openGoogleCalendar,
} from './calendarLinks';

function GoogleCalIcon() {
  return (
    <svg className="pp-bookConfirmCalBtn__svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" fill="#fff" stroke="#4285F4" strokeWidth="1.5" />
      <path d="M3 9h18" stroke="#4285F4" strokeWidth="1.5" />
      <rect x="7" y="2" width="2" height="4" rx="1" fill="#4285F4" />
      <rect x="15" y="2" width="2" height="4" rx="1" fill="#4285F4" />
      <text x="12" y="17" textAnchor="middle" fontSize="7" fontWeight="700" fill="#4285F4">
        31
      </text>
    </svg>
  );
}

function AppleCalIcon() {
  return (
    <svg className="pp-bookConfirmCalBtn__svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" fill="#fff" stroke="#1d1d1f" strokeWidth="1.5" />
      <path d="M3 9h18" stroke="#1d1d1f" strokeWidth="1.5" />
      <text x="12" y="17" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1d1d1f">
        6
      </text>
    </svg>
  );
}

export default function CalendarAddButtons({
  booking,
  className = 'pp-bookConfirmCalRow',
  googleLabel = 'Google',
  appleLabel = 'Apple',
  googleAria = 'Google Calendar',
  appleAria = 'Apple Calendar',
  groupAria = 'Add to calendar',
}) {
  const event = useMemo(() => (booking ? buildCalendarEvent(booking) : null), [booking]);
  const ready = event && hasCalendarTimes(event);

  if (!ready) return null;

  return (
    <div className={className} role="group" aria-label={groupAria}>
      <button
        type="button"
        className="pp-bookConfirmCalBtn"
        aria-label={googleAria}
        onClick={() => openGoogleCalendar(event)}
      >
        <GoogleCalIcon />
        <span>{googleLabel}</span>
      </button>
      <button
        type="button"
        className="pp-bookConfirmCalBtn"
        aria-label={appleAria}
        onClick={() => downloadAppleCalendar(event)}
      >
        <AppleCalIcon />
        <span>{appleLabel}</span>
      </button>
    </div>
  );
}

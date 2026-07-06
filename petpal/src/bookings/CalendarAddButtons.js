import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getCatalogProvider } from './bookingCatalog';
import {
  buildCalendarEvent,
  downloadAppleCalendar,
  googleCalendarUrl,
  hasCalendarTimes,
} from './calendarLinks';
import { getDb, isFirebaseConfigured } from '../firebase';

function GoogleCalIcon() {
  return (
    <svg className="pp-bookConfirmCalBtn__svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" fill="#fff" stroke="#e8eaed" strokeWidth="1" />
      <rect x="3" y="4" width="18" height="5" fill="#4285F4" />
      <text x="12" y="17" textAnchor="middle" fontSize="8" fontWeight="700" fill="#4285F4">
        31
      </text>
      <rect x="7" y="2" width="2" height="3" rx="0.5" fill="#4285F4" />
      <rect x="15" y="2" width="2" height="3" rx="0.5" fill="#4285F4" />
    </svg>
  );
}

function AppleCalIcon() {
  return (
    <svg className="pp-bookConfirmCalBtn__svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
      />
    </svg>
  );
}

function mergeBookingForCalendar(booking, providerMeta) {
  if (!booking) return null;
  const catalog = booking.companyId ? getCatalogProvider(booking.companyId) : null;
  const storeName =
    booking.storeName ||
    booking.providerName ||
    providerMeta?.storeName ||
    catalog?.displayName ||
    '';
  const providerAddress =
    booking.providerAddress ||
    booking.address ||
    providerMeta?.providerAddress ||
    catalog?.address ||
    '';

  return {
    ...booking,
    storeName,
    providerName: storeName,
    providerAddress,
    serviceName: booking.serviceName || booking.serviceSnapshot?.name || '',
    petName: booking.petName || booking.petSnapshot?.name || '',
  };
}

function useProviderCalendarMeta(booking) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (!booking?.companyId) {
      setMeta(null);
      return undefined;
    }

    const catalog = getCatalogProvider(booking.companyId);
    if (catalog) {
      setMeta({ storeName: catalog.displayName || '', providerAddress: catalog.address || '' });
      return undefined;
    }

    const hasStore = Boolean(booking.storeName || booking.providerName);
    const hasAddress = Boolean(booking.providerAddress || booking.address);
    if (hasStore && hasAddress) {
      setMeta(null);
      return undefined;
    }

    if (!isFirebaseConfigured()) return undefined;

    let cancelled = false;
    void getDoc(doc(getDb(), 'providers', String(booking.companyId)))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data() || {};
        setMeta({
          storeName: String(data.displayName || '').trim(),
          providerAddress: String(data.address || '').trim(),
        });
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      });

    return () => {
      cancelled = true;
    };
  }, [booking]);

  return meta;
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
  const providerMeta = useProviderCalendarMeta(booking);
  const calendarBooking = useMemo(
    () => mergeBookingForCalendar(booking, providerMeta),
    [booking, providerMeta]
  );
  const event = useMemo(() => (calendarBooking ? buildCalendarEvent(calendarBooking) : null), [calendarBooking]);
  const googleUrl = useMemo(() => (event ? googleCalendarUrl(event) : ''), [event]);
  const ready = event && hasCalendarTimes(event) && googleUrl;

  if (!ready) return null;

  return (
    <div className={className} role="group" aria-label={groupAria}>
      <a
        className="pp-bookConfirmCalBtn"
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={googleAria}
      >
        <GoogleCalIcon />
        <span>{googleLabel}</span>
      </a>
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

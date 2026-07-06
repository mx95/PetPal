import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { fetchCustomerBooking } from '../bookings/bookingFirestore';
import { getCatalogProvider } from '../bookings/bookingCatalog';
import CalendarAddButtons from '../bookings/CalendarAddButtons';
import { formatTime24 } from '../formatTime24';
import { slotEndDate, slotStartDate } from '../bookings/slotTime';
import { getDb, isFirebaseConfigured } from '../firebase';
import { useI18n } from '../i18n/I18nContext';
import { PageContainer } from '../components/ui';

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatWhenLine(date, lang = 'en') {
  if (!date) return '';
  const day = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = formatTime24(date, lang);
  return `${day} · ${time}`;
}

function durationBetween(start, end) {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

function providerInitials(name) {
  const s = String(name || '').trim();
  if (!s) return 'PP';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return s.slice(0, 2).toUpperCase();
}

async function resolveProviderMeta(companyId) {
  const catalog = getCatalogProvider(companyId);
  if (catalog) {
    return {
      providerName: String(catalog.displayName || ''),
      providerAddress: String(catalog.address || ''),
    };
  }
  if (!isFirebaseConfigured() || !companyId) {
    return { providerName: '', providerAddress: '' };
  }
  const snap = await getDoc(doc(getDb(), 'providers', String(companyId)));
  if (!snap.exists()) return { providerName: '', providerAddress: '' };
  const data = snap.data() || {};
  return {
    providerName: String(data.displayName || ''),
    providerAddress: String(data.address || ''),
  };
}

function enrichBooking(row, meta) {
  if (!row) return null;
  return {
    ...row,
    bookingId: row.bookingId || row.id,
    providerName: row.providerName || meta.providerName || '',
    providerAddress: row.providerAddress || meta.providerAddress || '',
    storeName: row.storeName || row.providerName || meta.providerName || '',
    serviceName: row.serviceName || row.serviceSnapshot?.name || '',
    petName: row.petName || row.petSnapshot?.name || '',
    price: row.price || row.variantSnapshot?.price || row.serviceSnapshot?.price || null,
  };
}

export default function BookingDetail() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingId } = useParams();
  const routeBooking = location.state?.booking && typeof location.state.booking === 'object' ? location.state.booking : null;

  const [booking, setBooking] = useState(() => enrichBooking(routeBooking, { providerName: '', providerAddress: '' }));
  const [loading, setLoading] = useState(!routeBooking);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    const id = String(bookingId || '');
    const cached =
      routeBooking && String(routeBooking.id) === id ? routeBooking : null;

    if (!id) {
      setLoading(false);
      setErr(t('bookingsHub.mineDetailNotFound'));
      return undefined;
    }

    void (async () => {
      if (!cached) setLoading(true);
      setErr('');
      try {
        let row = cached;
        if (!row) {
          row = await fetchCustomerBooking(id);
        }
        if (!row) {
          if (!cancelled) {
            setBooking(null);
            setErr(t('bookingsHub.mineDetailNotFound'));
          }
          return;
        }
        if (user?.uid && row.customerUid && String(row.customerUid) !== String(user.uid)) {
          if (!cancelled) {
            setBooking(null);
            setErr(t('bookingsHub.mineDetailNotFound'));
          }
          return;
        }
        const meta = await resolveProviderMeta(row.companyId);
        if (!cancelled) setBooking(enrichBooking(row, meta));
      } catch (e) {
        if (!cancelled) setErr(e?.message || t('bookingsHub.mineDetailNotFound'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId, routeBooking?.id, t, user?.uid]);

  const bookingStart = useMemo(() => slotStartDate(booking), [booking]);
  const bookingEnd = useMemo(() => slotEndDate(booking), [booking]);
  const bookingDuration = useMemo(() => {
    if (!booking) return null;
    if (typeof booking.durationMin === 'number') return booking.durationMin;
    const fromService = Number(booking.serviceSnapshot?.durationMin);
    if (Number.isFinite(fromService) && fromService > 0) return fromService;
    const fromVariant = Number(booking.variantSnapshot?.durationMin);
    if (Number.isFinite(fromVariant) && fromVariant > 0) return fromVariant;
    return durationBetween(bookingStart, bookingEnd);
  }, [booking, bookingStart, bookingEnd]);

  return (
    <PageContainer className="pp-bookHubWizard !py-4 sm:!py-5 lg:!py-6">
      <button type="button" className="pp-bookHubWizard__back" onClick={() => navigate('/bookings')}>
        ← {t('bookingsHub.mineDetailBack')}
      </button>

      <div className="pp-bookConfirmPage pp-bookConfirmPage--embedded">
        <header className="pp-bookConfirmPage__header">
          <h1 className="pp-bookConfirmPage__title">{t('bookingsHub.mineDetailTitle')}</h1>
        </header>

        {loading ? <p className="pp-book-muted">{t('bookingsHub.mineDetailLoading')}</p> : null}
        {err ? <div className="pp-bookConfirmPage__alert">{err}</div> : null}

        {!loading && booking ? (
          <>
            <section className="pp-bookConfirmPass" aria-label={t('bookConfirm.passAria')}>
              <div className="pp-bookConfirmPass__top">
                <div className="pp-bookConfirmPass__avatar" aria-hidden>
                  {providerInitials(booking.providerName)}
                </div>
                <div className="pp-bookConfirmPass__topText">
                  <span className="pp-bookConfirmPass__provider">
                    {booking.providerName || t('bookConfirm.providerFallback')}
                  </span>
                  <span className="pp-bookConfirmPass__service">
                    {booking.serviceName || t('bookConfirm.serviceFallback')}
                  </span>
                </div>
                <span className="pp-bookConfirmPass__badge">{t('bookConfirm.instantBadge')}</span>
              </div>
              <div className="pp-bookConfirmPass__divider" />
              <dl className="pp-bookConfirmPass__rows">
                <div className="pp-bookConfirmPass__row">
                  <dt>{t('bookingsHub.mineDetailStatus')}</dt>
                  <dd>{booking.status || '—'}</dd>
                </div>
                <div className="pp-bookConfirmPass__row">
                  <dt>{t('bookConfirm.petLabel')}</dt>
                  <dd>{booking.petName || '—'}</dd>
                </div>
                {booking.variantSnapshot?.label ? (
                  <div className="pp-bookConfirmPass__row">
                    <dt>{t('bookConfirm.variantLabel')}</dt>
                    <dd>{booking.variantSnapshot.label}</dd>
                  </div>
                ) : null}
                {booking.addonsSnapshot?.length ? (
                  <div className="pp-bookConfirmPass__row">
                    <dt>{t('bookConfirm.addonsLabel')}</dt>
                    <dd>
                      {booking.addonsSnapshot
                        .map((addon) => addon?.name || addon?.label)
                        .filter(Boolean)
                        .join(', ')}
                    </dd>
                  </div>
                ) : null}
                <div className="pp-bookConfirmPass__row">
                  <dt>{t('bookConfirm.whenLabel')}</dt>
                  <dd>{bookingStart ? formatWhenLine(bookingStart, language) : '—'}</dd>
                </div>
                {bookingDuration ? (
                  <div className="pp-bookConfirmPass__row">
                    <dt>{t('bookConfirm.durationLabel')}</dt>
                    <dd>{t('bookConfirm.mins', { n: bookingDuration })}</dd>
                  </div>
                ) : null}
                {booking.price ? (
                  <div className="pp-bookConfirmPass__row">
                    <dt>{t('bookConfirm.priceLabel')}</dt>
                    <dd>{booking.price}</dd>
                  </div>
                ) : null}
                {booking.providerAddress ? (
                  <div className="pp-bookConfirmPass__row">
                    <dt>{t('bookConfirm.addressLabel')}</dt>
                    <dd>{booking.providerAddress}</dd>
                  </div>
                ) : null}
                <div className="pp-bookConfirmPass__row pp-bookConfirmPass__row--ref">
                  <dt>{t('bookConfirm.refLabel')}</dt>
                  <dd>
                    <code className="pp-bookConfirmPass__code">{String(booking.bookingId || booking.id)}</code>
                  </dd>
                </div>
              </dl>
            </section>

            <CalendarAddButtons
              booking={booking}
              googleLabel={t('bookConfirm.calGoogleShort')}
              appleLabel={t('bookConfirm.calAppleShort')}
              googleAria={t('bookConfirm.calGoogleAria')}
              appleAria={t('bookConfirm.calAppleAria')}
              groupAria={t('bookConfirm.calGroupAria')}
            />

            <Link className="pp-bookConfirmPage__textCta" to="/bookings">
              {t('bookingsHub.mineDetailBack')}
            </Link>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}

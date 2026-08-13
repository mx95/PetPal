import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { subscribeAllBookings } from '../bookings/bookingFirestore';
import { formatDateTime24 } from '../formatTime24';
import { PrettySelect } from '../components/PrettySelect';
import { useI18n } from '../i18n/I18nContext';
import AdminCopyButton from '../admin/AdminCopyButton';
import {
  bookingCustomerName,
  bookingCustomerPhone,
  bookingPetName,
  bookingProviderName,
  bookingSearchHaystack,
  bookingServiceName,
  isWalkInBooking,
} from '../admin/adminBookingRow';

function bookingWhen(b, lang) {
  if (b.startAt?.toDate) return formatDateTime24(b.startAt.toDate(), lang);
  return '—';
}

function statusBadgeStyle(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'booked') return { background: 'rgba(46, 144, 250, 0.12)', color: '#1570ef' };
  if (s === 'completed') return { background: 'rgba(18, 183, 106, 0.12)', color: '#039855' };
  if (s === 'cancelled') return { background: 'rgba(152, 162, 179, 0.18)', color: '#475467' };
  return { background: 'rgba(152, 162, 179, 0.12)', color: '#475467' };
}

function serializeBooking(b) {
  const copy = { ...b };
  if (copy.startAt?.toDate) copy.startAt = copy.startAt.toDate().toISOString();
  if (copy.endAt?.toDate) copy.endAt = copy.endAt.toDate().toISOString();
  if (copy.createdAt?.toDate) copy.createdAt = copy.createdAt.toDate().toISOString();
  if (copy.updatedAt?.toDate) copy.updatedAt = copy.updatedAt.toDate().toISOString();
  return copy;
}

function statusLabel(status, t) {
  const s = String(status || '').toLowerCase();
  if (s === 'booked') return t('admin.bookings.statusBooked');
  if (s === 'completed') return t('admin.bookings.statusCompleted');
  if (s === 'cancelled') return t('admin.bookings.statusCancelled');
  return status || t('admin.bookings.statusUnknown');
}

function IdRow({ label, value, title }) {
  if (!value) return null;
  return (
    <div className="pp-adminBookingsIds__row">
      <span className="pp-adminBookingsIds__label" title={title}>
        {label}
      </span>
      <code className="pp-adminBookingsIds__value">{value}</code>
      <AdminCopyButton value={value} />
    </div>
  );
}

export default function AdminBookings() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState('');

  useEffect(() => {
    if (!firebaseReady || !isAdmin) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeAllBookings(
      (list) => {
        setRows(list);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || t('admin.bookings.errLoad'));
        setLoading(false);
      }
    );
    return unsub;
  }, [firebaseReady, isAdmin, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((b) => {
      if (statusFilter !== 'all' && String(b.status || '').toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      return bookingSearchHaystack(b).includes(q);
    });
  }, [rows, search, statusFilter]);

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge" style={{ background: 'rgba(180, 35, 24, 0.1)', color: '#b42318' }}>
              {t('admin.badge')}
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('admin.bookings.title')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 720 }}>
              {t('admin.bookings.sub')}
            </p>
          </div>
          <Link className="pp-link" to="/admin">
            {t('admin.backAdminTools')}
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-adminBookings">
          <div className="pp-adminBookingsFilters">
            <input
              className="pp-input"
              placeholder={t('admin.bookings.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <PrettySelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('admin.bookings.statusAll')}</option>
              <option value="booked">{t('admin.bookings.statusBooked')}</option>
              <option value="completed">{t('admin.bookings.statusCompleted')}</option>
              <option value="cancelled">{t('admin.bookings.statusCancelled')}</option>
            </PrettySelect>
          </div>

          {err ? <div className="pp-error">{err}</div> : null}
          {loading ? <div className="pp-muted">{t('admin.bookings.loading')}</div> : null}
          {!loading && filtered.length === 0 ? (
            <div className="pp-muted">
              {rows.length === 0 ? t('admin.bookings.empty') : t('admin.bookings.emptyFiltered')}
            </div>
          ) : null}

          {filtered.length ? (
            <div className="pp-adminBookingsTableWrap">
              <table className="pp-adminBookingsTable">
                <thead>
                  <tr>
                    <th>{t('admin.bookings.colWhen')}</th>
                    <th>{t('admin.bookings.colPet')}</th>
                    <th>{t('admin.bookings.colCustomer')}</th>
                    <th>{t('admin.bookings.colService')}</th>
                    <th>{t('admin.bookings.colProvider')}</th>
                    <th>{t('admin.bookings.colStatus')}</th>
                    <th className="pp-adminBookingsTable__actionsHead">
                      <span className="pp-srOnly">{t('admin.bookings.details')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const petName = bookingPetName(b) || t('admin.bookings.petFallback');
                    const customer = bookingCustomerName(b);
                    const phone = bookingCustomerPhone(b);
                    const serviceName = bookingServiceName(b) || t('admin.bookings.serviceFallback');
                    const provider = bookingProviderName(b) || b.companyId || '—';
                    const expanded = expandedId === b.id;
                    const walkIn = isWalkInBooking(b);
                    return (
                      <React.Fragment key={b.id}>
                        <tr>
                          <td data-label={t('admin.bookings.colWhen')} className="pp-adminBookingsTable__when">
                            {bookingWhen(b, language)}
                          </td>
                          <td data-label={t('admin.bookings.colPet')}>
                            <strong>{petName}</strong>
                            {walkIn ? (
                              <span className="pp-adminPetNfc__chip">{t('admin.bookings.walkIn')}</span>
                            ) : null}
                          </td>
                          <td data-label={t('admin.bookings.colCustomer')}>
                            <div>{customer || (walkIn ? t('admin.bookings.walkIn') : '—')}</div>
                            {phone ? <div className="pp-subtle">{phone}</div> : null}
                          </td>
                          <td data-label={t('admin.bookings.colService')}>{serviceName}</td>
                          <td data-label={t('admin.bookings.colProvider')} title={provider}>
                            {provider}
                          </td>
                          <td data-label={t('admin.bookings.colStatus')}>
                            <span className="pp-badge" style={statusBadgeStyle(b.status)}>
                              {statusLabel(b.status, t)}
                            </span>
                          </td>
                          <td className="pp-adminBookingsTable__actions">
                            <button
                              type="button"
                              className="pp-btn pp-btn--ghost"
                              onClick={() => setExpandedId(expanded ? '' : b.id)}
                            >
                              {expanded ? t('admin.bookings.hideDetails') : t('admin.bookings.details')}
                            </button>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="pp-adminBookingsTable__details">
                            <td colSpan={7}>
                              <div className="pp-adminBookingsIds">
                                <IdRow
                                  label={t('admin.bookings.idLabel')}
                                  value={b.id}
                                  title={t('admin.bookings.bookingIdTitle')}
                                />
                                <IdRow
                                  label={t('admin.bookings.customerLabel')}
                                  value={b.customerUid}
                                  title={t('admin.bookings.customerUidTitle')}
                                />
                                <IdRow
                                  label={t('admin.bookings.companyLabel')}
                                  value={b.companyId}
                                  title={t('admin.bookings.companyIdTitle')}
                                />
                              </div>
                              <pre className="pp-adminBookingsJson">
                                {JSON.stringify(serializeBooking(b), null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
